import { motion } from 'framer-motion';
import { SpeakWordButton } from './SpeakWordButton';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article, NounEntry } from '../types';
import { hardWordsInLevel } from '../lib/wordLists';

const articlePillClass: Record<Article, string> = {
  der: 'border-sky-400/40 bg-sky-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  die: 'border-rose-400/40 bg-rose-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  das: 'border-emerald-400/40 bg-emerald-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
};

const glassPanel =
  'rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.25)]';

interface DashboardWordListsProps {
  nounsInLevel: NounEntry[];
  hardWordIds: string[];
  onToggleKnown: (wordId: string) => void;
  onMasterTheseWords: () => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardWordLists({
  nounsInLevel,
  hardWordIds,
  onToggleKnown,
  onMasterTheseWords,
}: DashboardWordListsProps) {
  const { t } = useTranslation();

  const hardList = useMemo(
    () => hardWordsInLevel(nounsInLevel, hardWordIds),
    [nounsInLevel, hardWordIds],
  );

  if (hardList.length === 0) return null;

  return (
    <div className="mx-auto mt-5 flex w-full max-w-[420px] flex-col gap-4">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${glassPanel} p-4`}
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-artikl-text/90">
            {t('dashboard.hard_section_title')}
          </h2>
          {hardList.length > 0 ? (
            <button
              type="button"
              onClick={onMasterTheseWords}
              className="rounded-xl border border-violet-400/35 bg-violet-500/[0.12] px-3 py-2 text-center text-[11px] font-bold text-violet-100 backdrop-blur-[10px] transition-colors hover:border-violet-300/50 hover:bg-violet-500/[0.18] active:scale-[0.99]"
            >
              {t('dashboard.master_these_words')}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {hardList.map((entry) => (
            <div
              key={entry.id}
              className={`relative flex min-w-0 max-w-full items-center gap-1 rounded-xl border px-2.5 py-2 pr-14 ${articlePillClass[entry.article]}`}
            >
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-artikl-text/95">{entry.word}</p>
              <SpeakWordButton word={entry.word} className="text-[13px] opacity-80" />
              <button
                type="button"
                onClick={() => onToggleKnown(entry.id)}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-emerald-300/95 backdrop-blur-[8px] transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-200"
                aria-label={t('dashboard.archive_word_aria')}
                title={t('dashboard.archive_word_title')}
              >
                <CheckIcon />
              </button>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
