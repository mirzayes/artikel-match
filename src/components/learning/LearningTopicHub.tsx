import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GOETHE_LEVELS, type GoetheLevel, type NounEntry } from '../../types';
import { filterLearningQuizPool } from '../../lib/wordLists';
import { countMasteredInLevel } from '../../lib/dashboardBuckets';

interface LearningTopicHubProps {
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  selectedLevel: GoetheLevel;
  onLevelChange: (level: GoetheLevel) => void;
  onStartLevel: () => void;
}

export function LearningTopicHub({
  nounsByLevel,
  knownWordIds,
  masteryByWordId,
  selectedLevel,
  onLevelChange,
  onStartLevel,
}: LearningTopicHubProps) {
  const { t } = useTranslation();

  const levelNouns = useMemo(() => nounsByLevel[selectedLevel] ?? [], [nounsByLevel, selectedLevel]);

  const levelTotalCount = levelNouns.length;

  const masteredInLevel = useMemo(
    () => countMasteredInLevel(levelNouns, knownWordIds, masteryByWordId),
    [levelNouns, knownWordIds, masteryByWordId],
  );

  const eligibleAllCount = useMemo(
    () => filterLearningQuizPool(levelNouns, knownWordIds).length,
    [levelNouns, knownWordIds],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-32 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-36">
      <div className="mx-auto w-full max-w-[420px]">
        <h1 className="font-display text-center text-sm font-bold uppercase tracking-[0.2em] text-white/90">
          {t('learning_topics.section_title')}
        </h1>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GOETHE_LEVELS.map((lvl) => {
            const active = lvl === selectedLevel;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onLevelChange(lvl)}
                className={[
                  'shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold tabular-nums transition-all duration-200',
                  active
                    ? 'relative border border-cyan-400/55 bg-gradient-to-br from-violet-600/50 via-violet-500/35 to-cyan-500/30 text-white shadow-[0_0_22px_rgba(139,92,246,0.45),0_0_14px_rgba(34,211,238,0.28)] ring-1 ring-violet-400/50'
                    : 'border border-white/12 bg-white/[0.05] text-white/55 backdrop-blur-[10px] hover:border-white/22 hover:bg-white/[0.08] hover:text-white/75',
                ].join(' ')}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[11px] font-medium tabular-nums text-white/45">
          {t('learning_topics.level_noun_count', { level: selectedLevel, count: levelTotalCount })}
        </p>

        <motion.button
          type="button"
          whileHover={{ scale: 1.012 }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          onClick={onStartLevel}
          disabled={eligibleAllCount === 0}
          className="mx-auto mt-8 flex w-full max-w-[380px] flex-col rounded-[22px] border border-white/[0.14] bg-gradient-to-br from-violet-500/[25] via-fuchsia-500/[14] to-cyan-500/[18] px-5 py-6 text-left shadow-[0_16px_52px_rgba(99,102,241,0.2)] backdrop-blur-[14px] transition-[box-shadow,border-color] hover:border-violet-300/35 hover:shadow-[0_20px_56px_rgba(139,92,246,0.24)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="block text-[17px] font-bold leading-snug text-white">
            {t('learning_topics.learn_all_title')}
          </span>
          <span className="mt-2 block text-[12px] font-medium leading-relaxed text-white/58">
            {t('learning_topics.learn_all_sub')}
          </span>
          <p className="mt-4 text-center text-[13px] font-semibold tabular-nums text-white/90">
            {t('learning_topics.level_progress_line', {
              mastered: masteredInLevel,
              total: levelTotalCount,
            })}
          </p>
          <span className="mt-3 inline-flex self-center rounded-xl border border-white/12 bg-black/22 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/52 backdrop-blur-sm">
            {eligibleAllCount.toLocaleString()} {t('learning_topics.words_ready')}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
