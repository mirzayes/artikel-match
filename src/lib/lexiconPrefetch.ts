import type { QueryClient } from '@tanstack/react-query';
import type { GoetheLevel, NounEntry } from '../types';
import { GOETHE_LEVELS } from '../types';
import { buildLexiconCatalog } from './lexiconCompact';

export function lexiconVocabSignature(nounsByLevel: Record<GoetheLevel, NounEntry[]>): string {
  return GOETHE_LEVELS.map((l) => nounsByLevel[l].length).join('-');
}

/** Dashboard açılanda Lüğət kataloqu üçün arxa fon prefetch. */
export function prefetchLexiconCatalog(
  queryClient: QueryClient,
  nounsByLevel: Record<GoetheLevel, NounEntry[]>,
): void {
  const sig = lexiconVocabSignature(nounsByLevel);
  if (sig === '0-0-0-0-0') return;
  void queryClient.prefetchQuery({
    queryKey: ['lexicon', 'catalog', sig],
    queryFn: () => buildLexiconCatalog(nounsByLevel),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
