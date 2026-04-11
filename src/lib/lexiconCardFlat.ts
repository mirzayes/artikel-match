import type { LexiconCardFlatRow } from '../components/lexicon/LexiconCardVirtualStream';
import type { LexiconListRowModel } from '../components/lexicon/LexiconListRow';
import { getLexiconDisplayGroup, sortLexiconGroupKeys } from './lexiconGrouping';

function rowGroupKey(r: LexiconListRowModel): string {
  return getLexiconDisplayGroup(r.level, r.article, r.word, r.category);
}

/** Yüklənmiş sətirlərdən virtual kart axını; başlıq sayı tam filtr nəticəsindən (`groupCounts`). */
export function buildLexiconCardFlatRowsFromLoaded(
  loadedRows: LexiconListRowModel[],
  groupCounts: Record<string, number>,
): LexiconCardFlatRow[] {
  const byGroup = new Map<string, LexiconListRowModel[]>();
  for (const w of loadedRows) {
    const k = rowGroupKey(w);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k)!.push(w);
  }
  for (const arr of byGroup.values()) {
    arr.sort((a, b) => a.word.localeCompare(b.word, 'de'));
  }

  const out: LexiconCardFlatRow[] = [];
  for (const cat of sortLexiconGroupKeys([...Object.keys(groupCounts)])) {
    const items = byGroup.get(cat);
    const total = groupCounts[cat] ?? 0;
    if (!items?.length) continue;
    out.push({ kind: 'header', key: `h-${cat}`, title: cat, count: total });
    for (const item of items) {
      out.push({ kind: 'card', key: item.id, item });
    }
  }
  return out;
}

/** Geniş ekran: qrup üzrə siyahı (yalnız yüklənmiş sözlər). */
export function groupLoadedRowsForGrid(
  loadedRows: LexiconListRowModel[],
  groupCounts: Record<string, number>,
): { cat: string; items: LexiconListRowModel[]; totalInGroup: number }[] {
  const byGroup = new Map<string, LexiconListRowModel[]>();
  for (const w of loadedRows) {
    const k = rowGroupKey(w);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k)!.push(w);
  }
  for (const arr of byGroup.values()) {
    arr.sort((a, b) => a.word.localeCompare(b.word, 'de'));
  }
  const out: { cat: string; items: LexiconListRowModel[]; totalInGroup: number }[] = [];
  for (const cat of sortLexiconGroupKeys([...Object.keys(groupCounts)])) {
    const items = byGroup.get(cat);
    if (!items?.length) continue;
    out.push({ cat, items, totalInGroup: groupCounts[cat] ?? items.length });
  }
  return out;
}
