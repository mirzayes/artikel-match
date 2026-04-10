import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { Article, GoetheLevel, NounEntry } from '../types';
import { getNounTranslation, isRtlGlossLang, usesRemoteGlossFile } from '../lib/nounTranslation';
import { useGlossLanguage, useGlossRemote } from '../hooks/useGlossLanguage';

const articleText: Record<Article, string> = {
  der: 'text-der',
  die: 'text-die',
  das: 'text-das',
};

type HardWordsArchiveScreenProps = {
  level: GoetheLevel;
  nounsInLevel: NounEntry[];
  hardWordIds: string[];
  onBack: () => void;
  onRemoveFromHard: (wordId: string) => void;
  onStartReview: () => void;
};

export function HardWordsArchiveScreen({
  level,
  nounsInLevel,
  hardWordIds,
  onBack,
  onRemoveFromHard,
  onStartReview,
}: HardWordsArchiveScreenProps) {
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById } = useGlossRemote();
  const entries = useMemo(() => {
    const byId = new Map(nounsInLevel.map((n) => [n.id, n]));
    return [...hardWordIds].reverse().map((id) => byId.get(id)).filter((e): e is NounEntry => Boolean(e));
  }, [hardWordIds, nounsInLevel]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-28 pt-6 text-stone-200 sm:px-6 sm:pb-32 sm:pt-8">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mb-5 w-full max-w-md"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/12 bg-[var(--artikl-surface)] px-3 py-2 text-sm font-semibold text-artikl-text transition-colors hover:border-[var(--artikl-border2)] hover:bg-[var(--artikl-surface2)] active:scale-[0.98]"
          >
            ← Geri
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-artikl-text sm:text-xl">
            Çətin sözlər — arxiv
          </h1>
        </div>
        <p className="mt-2 text-center text-[11px] text-artikl-caption">
          {level} · {entries.length} söz
        </p>
      </motion.header>

      <div className="mx-auto w-full max-w-md flex-1">
        {entries.length === 0 ? (
          <p className="mt-8 text-center text-sm text-artikl-caption">Arxiv boşdur.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-2.5 py-2 sm:px-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-[13px] font-semibold leading-tight text-artikl-text">
                    <span className={`font-semibold capitalize ${articleText[entry.article]}`}>
                      {entry.article}
                    </span>{' '}
                    {entry.word}
                  </p>
                  <p
                    className="truncate text-[11px] leading-tight text-artikl-caption"
                    style={
                      isRtlGlossLang(glossLang)
                        ? { direction: 'rtl', textAlign: 'right' as const }
                        : undefined
                    }
                  >
                    {getNounTranslation(
                      entry,
                      glossLang,
                      usesRemoteGlossFile(glossLang) ? remoteGlossById : null,
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFromHard(entry.id)}
                  className="shrink-0 rounded-lg border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-2 py-1 text-[10px] font-semibold text-artikl-text transition-colors hover:border-white/16 hover:bg-[var(--artikl-surface2)] active:scale-[0.97]"
                >
                  Çıxart
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onStartReview}
          className="mt-6 w-full rounded-2xl border-2 border-purple-600 bg-purple-600 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98] dark:border-transparent dark:bg-[var(--artikl-accent)] dark:shadow-violet-900/25"
        >
          Səhv və çətin sözləri təkrarla
        </button>
      </div>
    </div>
  );
}
