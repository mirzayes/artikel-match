import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GoetheLevel, NounEntry } from '../types';
import {
  LEXICON_PUBLIC_URL,
  applyNounsByLevelInChunks,
  buildWordCounts,
  emptyNounsByLevel,
  loadBundledLexiconProgressive,
  mergeLexiconWithBundled,
  parseGoetheLexiconJson,
} from '../data/words';

type VocabularyContextValue = {
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  wordCountByLevel: Record<GoetheLevel, number>;
  totalWordCount: number;
  /** true əgər şəbəkədən uğurla genişləndirilmiş leksikon tətbiq olundusa */
  usingExternalLexicon: boolean;
};

const VocabularyContext = createContext<VocabularyContextValue | null>(null);

export function VocabularyProvider({ children }: { children: ReactNode }) {
  const [nounsByLevel, setNounsByLevel] = useState<Record<GoetheLevel, NounEntry[]>>(() =>
    emptyNounsByLevel(),
  );
  const [usingExternalLexicon, setUsingExternalLexicon] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const bundledPromise = loadBundledLexiconProgressive({
        onUpdate: (next) => {
          if (!cancelled) setNounsByLevel(next);
        },
      });

      const json = await fetch(LEXICON_PUBLIC_URL)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const bundledFull = await bundledPromise;
      if (cancelled) return;

      if (json == null) return;

      const parsed = parseGoetheLexiconJson(json);
      if (!parsed) return;

      const merged = mergeLexiconWithBundled(parsed, bundledFull);
      await applyNounsByLevelInChunks(merged, (next) => {
        if (!cancelled) setNounsByLevel(next);
      });
      if (!cancelled) setUsingExternalLexicon(true);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => {
    const { wordCountByLevel, totalWordCount } = buildWordCounts(nounsByLevel);
    return { nounsByLevel, wordCountByLevel, totalWordCount, usingExternalLexicon };
  }, [nounsByLevel, usingExternalLexicon]);

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

export function useVocabulary(): VocabularyContextValue {
  const ctx = useContext(VocabularyContext);
  if (!ctx) throw new Error('useVocabulary tələb VocabularyProvider');
  return ctx;
}
