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
            className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[rgba(232,232,245,0.85)] transition-colors hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]"
          >
            ← Geri
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-white sm:text-xl">
            Çətin sözlər — arxiv
          </h1>
        </div>
        <p className="mt-2 text-center text-[11px] text-[rgba(232,232,245,0.45)]">
          {level} · {entries.length} söz
        </p>
      </motion.header>

      <div className="mx-auto w-full max-w-md flex-1">
        {entries.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[rgba(232,232,245,0.45)]">Arxiv boşdur.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 sm:px-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-[13px] font-semibold leading-tight text-white">
                    <span className={`font-semibold capitalize ${articleText[entry.article]}`}>
                      {entry.article}
                    </span>{' '}
                    {entry.word}
                  </p>
                  <p
                    className="truncate text-[11px] leading-tight text-[rgba(232,232,245,0.4)]"
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
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-[rgba(232,232,245,0.65)] transition-colors hover:border-white/16 hover:bg-white/[0.07] active:scale-[0.97]"
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
          className="mt-6 w-full rounded-2xl border border-transparent bg-[var(--artikl-accent)] py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-transform active:scale-[0.98]"
        >
          Səhv və çətin sözləri təkrarla
        </button>
      </div>
    </div>
  );
}
