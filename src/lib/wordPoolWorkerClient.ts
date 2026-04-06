import type { NounEntry, NounTranslationLang } from '../types';
import type { VokabelRow } from './vokabelnCsv';
import { nounToVokabelRow } from './nounTranslation';

type WorkerIn = { reqId: string; type: 'duelDeck'; nouns: VokabelRow[] };

type WorkerOut = {
  reqId: string;
  type: 'duelDeck';
  rows: VokabelRow[];
  order: number[];
  error?: string;
};

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/wordPool.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

function nounsToRows(
  nouns: NounEntry[],
  glossLang: NounTranslationLang,
  remoteById?: Readonly<Record<string, string>> | null,
): VokabelRow[] {
  return nouns.map((n) => nounToVokabelRow(n, glossLang, remoteById));
}

function nextReqId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function requestDuelDeckFromWorker(
  nounsInLevel: NounEntry[],
  glossLang: NounTranslationLang,
  remoteById?: Readonly<Record<string, string>> | null,
): Promise<{
  rows: VokabelRow[];
  order: number[];
}> {
  const w = getWorker();
  const reqId = nextReqId();
  const nouns = nounsToRows(nounsInLevel, glossLang, remoteById);
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerOut>) => {
      const d = e.data;
      if (d.reqId !== reqId) return;
      w.removeEventListener('message', onMessage);
      if (d.error) reject(new Error(d.error));
      else resolve({ rows: d.rows, order: d.order });
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ reqId, type: 'duelDeck', nouns } satisfies WorkerIn);
  });
}
