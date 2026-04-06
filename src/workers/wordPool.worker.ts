/// <reference lib="webworker" />

import type { Article } from '../types';

type NounWire = { id: string; article: Article; word: string; translation: string };

type InMsg = { reqId: string; type: 'duelDeck'; nouns: NounWire[] };

function shuffleIndices(length: number): number[] {
  const a = Array.from({ length }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (!msg || typeof msg !== 'object' || typeof msg.reqId !== 'string' || msg.type !== 'duelDeck') return;
  const { reqId, nouns } = msg;
  try {
    if (!nouns.length) {
      self.postMessage({ reqId, type: 'duelDeck', rows: [], order: [] });
      return;
    }
    const rows = nouns;
    const order = shuffleIndices(rows.length);
    self.postMessage({ reqId, type: 'duelDeck', rows, order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'worker error';
    self.postMessage({ reqId, type: 'duelDeck', rows: [], order: [], error: message });
  }
};
