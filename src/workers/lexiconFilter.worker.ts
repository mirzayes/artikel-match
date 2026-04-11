import { filterLexiconCatalogSync, type LexiconCompactRow } from '../lib/lexiconCompact';
import type { Article, GoetheLevel } from '../types';

type Msg = {
  rows: LexiconCompactRow[];
  filter: Article | 'all';
  levelFilter: GoetheLevel | 'all';
  q: string;
};

self.onmessage = (e: MessageEvent<Msg>) => {
  const { rows, filter, levelFilter, q } = e.data;
  const result = filterLexiconCatalogSync(rows, filter, levelFilter, q);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(result);
};

export {};
