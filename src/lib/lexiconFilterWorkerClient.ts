import type { LexiconCompactRow } from './lexiconCompact';
import type { LexiconFilterResult } from './lexiconCompact';
import type { Article, GoetheLevel } from '../types';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (typeof window === 'undefined') {
    throw new Error('lexicon_worker_browser_only');
  }
  if (!worker) {
    worker = new Worker(new URL('../workers/lexiconFilter.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

type FilterPayload = {
  rows: LexiconCompactRow[];
  filter: Article | 'all';
  levelFilter: GoetheLevel | 'all';
  q: string;
};

export function filterLexiconInWorker(payload: FilterPayload): Promise<LexiconFilterResult> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('lexicon_filter_timeout')), 14_000);
    const onMsg = (e: MessageEvent<LexiconFilterResult>) => {
      window.clearTimeout(t);
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
      resolve(e.data);
    };
    const onErr = () => {
      window.clearTimeout(t);
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
      reject(new Error('lexicon_filter_worker_error'));
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage(payload);
  });
}
