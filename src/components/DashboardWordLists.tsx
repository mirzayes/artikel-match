import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article, NounEntry } from '../types';
import { hardWordsInLevel } from '../lib/wordLists';
import { SpeakWordButton } from './SpeakWordButton';

const articlePillClass: Record<Article, string> = {
  der: 'border-sky-400/55 bg-sky-500/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
  die: 'border-rose-400/55 bg-rose-500/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
  das: 'border-emerald-400/55 bg-emerald-500/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
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
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const hardList = useMemo(
    () => hardWordsInLevel(nounsInLevel, hardWordIds),
    [nounsInLevel, hardWordIds],
  );

  if (hardList.length === 0) return null;

  const n = hardList.length;

  return (
    <div className="mx-auto mt-3 flex w-full max-w-[420px] flex-col">
      <div className={`${glassPanel} overflow-hidden`}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            id="dw-hard-toggle"
            aria-expanded={open}
            aria-controls="dw-hard-list-panel"
            onClick={() => setOpen((v) => !v)}
            className="lex-no-tap-highlight flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl text-left outline-none ring-violet-400/30 focus-visible:ring-2"
          >
            <span
              className={[
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-[10px] text-artikl-caption transition-transform duration-200',
                open ? 'rotate-90' : '',
              ].join(' ')}
              aria-hidden
            >
              ▸
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-artikl-text/90">
                {t('dashboard.hard_section_title')}
              </h2>
              <p className="mt-0.5 text-[10px] text-artikl-caption">
                {t('dashboard.hard_expand_hint', { count: n })}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onMasterTheseWords()}
            className="shrink-0 rounded-lg border border-violet-400/35 bg-violet-500/[0.14] px-2.5 py-1.5 text-center text-[10px] font-bold text-violet-100 backdrop-blur-[10px] transition-colors hover:border-violet-300/50 hover:bg-violet-500/[0.22] active:scale-[0.99]"
          >
            {t('dashboard.master_these_words')}
          </button>
        </div>

        <motion.div
          id="dw-hard-list-panel"
          role="region"
          aria-labelledby="dw-hard-toggle"
          initial={false}
          animate={{ height: open ? 'auto' : 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="overflow-hidden border-t border-white/[0.08]"
        >
          <div
            className="max-h-[min(400px,calc(100dvh-var(--app-bottom-pad,7rem)-10rem))] overflow-y-auto overscroll-y-contain px-2 pb-8 pt-2 [scrollbar-width:thin]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <ul className="flex flex-col gap-2.5">
              {hardList.map((entry) => (
                <li
                  key={entry.id}
                  className={[
                    'flex w-full items-stretch gap-2 rounded-xl border-2 px-3 py-2.5 ring-1 ring-black/10 dark:ring-white/[0.06]',
                    articlePillClass[entry.article],
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-artikl-text/95">{entry.word}</p>
                    <SpeakWordButton word={entry.word} className="shrink-0 text-[14px] opacity-85" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleKnown(entry.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border-2 border-white/20 bg-black/30 text-emerald-300/95 backdrop-blur-[8px] transition-colors hover:border-emerald-400/45 hover:bg-emerald-500/15 hover:text-emerald-200"
                    aria-label={t('dashboard.archive_word_aria')}
                    title={t('dashboard.archive_word_title')}
                  >
                    <CheckIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
