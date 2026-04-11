import type { Article, GoetheLevel, NounEntry } from '../types';
import { GOETHE_LEVELS } from '../types';
import { getLexiconDisplayGroup, sortLexiconGroupKeys } from './lexiconGrouping';

/** Minimal sıra — filtr / worker üçün (JSON clone yüngül). */
export type LexiconCompactRow = {
  id: string;
  w: string;
  a: Article;
  lv: GoetheLevel;
  /** Qrup başlığı (kart sırası). */
  gKey: string;
  /** Axtarış üçün birleşik mətn (kiçik hərflə). */
  blob: string;
  cat?: string;
};

export type LexiconCatalogBuild = {
  rows: LexiconCompactRow[];
  byId: Map<string, NounEntry>;
};

export function buildLexiconCatalog(nounsByLevel: Record<GoetheLevel, NounEntry[]>): LexiconCatalogBuild {
  const byId = new Map<string, NounEntry>();
  const rows: LexiconCompactRow[] = [];
  for (const lv of GOETHE_LEVELS) {
    for (const n of nounsByLevel[lv]) {
      byId.set(n.id, n);
      const tr = n.translation?.trim() ?? '';
      const az = n.translations?.az?.trim() ?? '';
      const en = n.translations?.en?.trim() ?? '';
      const blob = [n.word, tr, az, en, n.article, n.level, n.category ?? '']
        .join('\n')
        .toLowerCase();
      const gKey = getLexiconDisplayGroup(n.level, n.article, n.word, n.category);
      rows.push({
        id: n.id,
        w: n.word,
        a: n.article,
        lv: n.level,
        gKey,
        blob,
        cat: n.category,
      });
    }
  }
  return { rows, byId };
}

export function countArticlesInNouns(nounsByLevel: Record<GoetheLevel, NounEntry[]>): {
  der: number;
  die: number;
  das: number;
} {
  let der = 0;
  let die = 0;
  let das = 0;
  for (const lv of GOETHE_LEVELS) {
    for (const n of nounsByLevel[lv]) {
      if (n.article === 'der') der++;
      else if (n.article === 'die') die++;
      else das++;
    }
  }
  return { der, die, das };
}

export type LexiconFilterResult = {
  sortedIds: string[];
  groupCounts: Record<string, number>;
};

export function filterLexiconCatalogSync(
  rows: LexiconCompactRow[],
  filter: Article | 'all',
  levelFilter: GoetheLevel | 'all',
  qRaw: string,
): LexiconFilterResult {
  const q = qRaw.trim().toLowerCase();
  const groupCounts: Record<string, number> = {};

  const matched: LexiconCompactRow[] = [];
  for (const r of rows) {
    if (filter !== 'all' && r.a !== filter) continue;
    if (levelFilter !== 'all' && r.lv !== levelFilter) continue;
    if (q) {
      if (!r.blob.includes(q)) continue;
    }
    matched.push(r);
    groupCounts[r.gKey] = (groupCounts[r.gKey] ?? 0) + 1;
  }

  matched.sort((a, b) => {
    const order = sortLexiconGroupKeys([a.gKey, b.gKey]);
    if (a.gKey !== b.gKey) return order.indexOf(a.gKey) - order.indexOf(b.gKey);
    return a.w.localeCompare(b.w, 'de');
  });

  return { sortedIds: matched.map((r) => r.id), groupCounts };
}
