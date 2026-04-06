import { useEffect, useState } from 'react';
import type { Article } from '../../types';
import {
  fetchWordExplanation,
  getCachedWordExplanation,
  hasCachedWordExplanation,
  isWordExplainApiConfigured,
} from '../../lib/wordAiExplain';

type Props = {
  wordId: string;
  article: Article;
  word: string;
  translation: string;
};

function SkeletonBlock() {
  return (
    <div
      className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
      aria-busy
      aria-label="İzah hazırlanır"
    >
      <div className="artikl-ai-skeleton-line mb-2 w-[38%]" />
      <div className="artikl-ai-skeleton-line mb-2 w-full" />
      <div className="artikl-ai-skeleton-line mb-2 w-[92%]" />
      <div className="artikl-ai-skeleton-line w-[64%]" />
    </div>
  );
}

export function QuizWordAiExplain({ wordId, article, word, translation }: Props) {
  const configured = isWordExplainApiConfigured();
  const [text, setText] = useState<string | null>(() =>
    configured && hasCachedWordExplanation(wordId) ? getCachedWordExplanation(wordId)! : null,
  );
  const [loading, setLoading] = useState(() => configured && !hasCachedWordExplanation(wordId));

  useEffect(() => {
    if (!configured) return;

    if (hasCachedWordExplanation(wordId)) {
      setText(getCachedWordExplanation(wordId)!);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setText(null);
    fetchWordExplanation({ wordId, article, word, translation }).then((t) => {
      if (!alive) return;
      setLoading(false);
      setText(t);
    });
    return () => {
      alive = false;
    };
  }, [configured, wordId, article, word, translation]);

  if (!configured) return null;
  if (loading) return <SkeletonBlock />;
  if (!text) return null;

  return (
    <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-4 text-left">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-violet-200/55">İzah</p>
      <p className="mt-2 text-sm leading-relaxed text-[rgba(232,232,245,0.82)]">{text}</p>
    </div>
  );
}
