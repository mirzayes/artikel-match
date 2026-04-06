import type { Article } from '../types';

const explanationCache = new Map<string, string>();

export function getCachedWordExplanation(wordId: string): string | undefined {
  return explanationCache.get(wordId);
}

export function hasCachedWordExplanation(wordId: string): boolean {
  return explanationCache.has(wordId);
}

export function setCachedWordExplanation(wordId: string, text: string): void {
  explanationCache.set(wordId, text);
}

export function isWordExplainApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_WORD_EXPLAIN_URL?.trim());
}

export type ExplainRequestPayload = {
  wordId: string;
  article: Article;
  word: string;
  translation: string;
};

/**
 * POST JSON to VITE_WORD_EXPLAIN_URL; server cavabı: { "explanation": "..." } və ya təmiz mətn.
 * Əvvəlcə `getCachedWordExplanation` yoxlanılmalıdır (komponentdə).
 */
export async function fetchWordExplanation(payload: ExplainRequestPayload): Promise<string | null> {
  const base = import.meta.env.VITE_WORD_EXPLAIN_URL?.trim();
  if (!base) return null;

  if (explanationCache.has(payload.wordId)) {
    return explanationCache.get(payload.wordId)!;
  }

  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;

  const rawText = await res.text();
  let text = '';
  try {
    const data = JSON.parse(rawText) as { explanation?: unknown };
    if (typeof data.explanation === 'string') text = data.explanation.trim();
  } catch {
    text = rawText.trim();
  }
  if (!text) return null;

  explanationCache.set(payload.wordId, text);
  return text;
}
