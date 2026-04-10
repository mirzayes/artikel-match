import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  GOETHE_LEVELS,
  type ExamQuestionPreset,
  type ExamSessionConfig,
  type ExamTopicMode,
  type GoetheLevel,
  type NounEntry,
} from '../../types';
import { excludeKnownNouns } from '../../lib/wordLists';

interface ExamSettingsProps {
  defaultLevel: GoetheLevel;
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  knownWordIds: string[];
  wrongCountByWordId: Record<string, number>;
  onStart: (cfg: ExamSessionConfig) => void;
  /** en/ru/tr tərcümə faylı yüklənənə qədər false */
  canStartWithGloss?: boolean;
  glossLoading?: boolean;
}

const PRESETS: ExamQuestionPreset[] = [10, 20, 50, 'infinite'];

export function ExamSettings({
  defaultLevel,
  nounsByLevel,
  knownWordIds,
  wrongCountByWordId,
  onStart,
  canStartWithGloss = true,
  glossLoading = false,
}: ExamSettingsProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<GoetheLevel>(defaultLevel);
  const [questions, setQuestions] = useState<ExamQuestionPreset>(20);
  const [topics, setTopics] = useState<ExamTopicMode>('all');

  useEffect(() => {
    setLevel(defaultLevel);
  }, [defaultLevel]);

  const presetLabel = (p: ExamQuestionPreset) =>
    p === 'infinite' ? t('exam.preset_infinite') : String(p);

  const wrongOnlyAvailable = useMemo(() => {
    const nouns = excludeKnownNouns(nounsByLevel[level], knownWordIds);
    return nouns.some((n) => (wrongCountByWordId[n.id] ?? 0) > 0);
  }, [level, nounsByLevel, knownWordIds, wrongCountByWordId]);

  const handleStart = () => {
    if (topics === 'wrong' && !wrongOnlyAvailable) return;
    onStart({ level, questions, topics });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-36 pt-[max(12px,env(safe-area-inset-top))] text-[#1A1A2E] dark:text-stone-200 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md pt-4"
      >
        <h1 className="mb-6 text-center font-display text-xl font-bold tracking-wide text-artikl-text sm:text-2xl">
          {t('exam.settings_title')}
        </h1>

        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="gamify-block-title text-center">{t('exam.level_section')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {GOETHE_LEVELS.map((lvl) => {
              const on = lvl === level;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={[
                    'rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
                    on
                      ? 'border-2 border-purple-600 bg-purple-600 text-white dark:border-transparent dark:bg-[var(--artikl-accent)] dark:text-white'
                      : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-transparent dark:text-[var(--artikl-muted2)] hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface)]',
                  ].join(' ')}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-card mt-5 rounded-2xl p-5 sm:p-6">
          <p className="gamify-block-title text-center">{t('exam.question_count_section')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PRESETS.map((p) => {
              const on = questions === p;
              return (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setQuestions(p)}
                  className={[
                    'min-w-[4.5rem] rounded-full px-4 py-2.5 text-sm font-semibold transition-colors',
                    on
                      ? 'border-2 border-purple-600 bg-purple-600 text-white dark:border-violet-400/50 dark:bg-gradient-to-br dark:from-violet-600/35 dark:to-fuchsia-600/25'
                      : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-transparent dark:text-[var(--artikl-muted2)] hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface)]',
                  ].join(' ')}
                >
                  {presetLabel(p)}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-card mt-5 rounded-2xl p-5 sm:p-6">
          <p className="gamify-block-title text-center">{t('exam.topics_section')}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <button
              type="button"
              onClick={() => setTopics('all')}
              className={[
                'rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors',
                topics === 'all'
                  ? 'border-2 border-purple-600 bg-purple-600 text-white dark:border-violet-400/45 dark:bg-violet-600/20'
                  : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-transparent dark:text-[var(--artikl-muted2)] hover:dark:border-[var(--artikl-border2)]',
              ].join(' ')}
            >
              {t('exam.topic_all')}
            </button>
            <button
              type="button"
              onClick={() => setTopics('wrong')}
              disabled={!wrongOnlyAvailable}
              className={[
                'rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors',
                topics === 'wrong'
                  ? 'border-2 border-purple-600 bg-purple-600 text-white dark:border-rose-400/45 dark:bg-rose-600/20'
                  : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-transparent dark:text-[var(--artikl-muted2)] hover:dark:border-[var(--artikl-border2)]',
                !wrongOnlyAvailable
                  ? 'cursor-not-allowed text-[#9CA3AF] dark:text-[var(--artikl-muted2)] dark:opacity-45'
                  : '',
              ].join(' ')}
            >
              {t('exam.topic_wrong')}
            </button>
          </div>
          {topics === 'wrong' && !wrongOnlyAvailable ? (
            <p className="mt-3 text-center text-xs text-[#4B5563] dark:text-amber-400/90">
              {t('exam.wrong_only_unavailable')}
            </p>
          ) : null}
        </section>

        {glossLoading ? (
          <p className="mt-4 text-center text-xs text-artikl-muted2">{t('exam.gloss_loading')}</p>
        ) : null}

        <button
          type="button"
          onClick={handleStart}
          disabled={(topics === 'wrong' && !wrongOnlyAvailable) || !canStartWithGloss}
          className="mt-8 w-full rounded-2xl border-2 border-purple-600 bg-purple-600 py-4 text-[15px] font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:border-purple-300 disabled:bg-purple-300 disabled:text-[#9CA3AF] dark:bg-gradient-to-r dark:from-violet-600 dark:via-fuchsia-600 dark:to-purple-600 dark:shadow-violet-900/30 dark:disabled:opacity-50"
        >
          {t('dashboard.start_exam')}
        </button>
      </motion.div>
    </div>
  );
}
