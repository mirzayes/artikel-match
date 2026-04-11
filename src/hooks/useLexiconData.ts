import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { LexiconListRowModel } from '../components/lexicon/LexiconListRow';
import { useGlossLanguage, useGlossRemote } from './useGlossLanguage';
import { useVocabulary } from '../context/VocabularyContext';
import {
  buildLexiconCatalog,
  countArticlesInNouns,
  filterLexiconCatalogSync,
  type LexiconFilterResult,
} from '../lib/lexiconCompact';
import { filterLexiconInWorker } from '../lib/lexiconFilterWorkerClient';
import { lexiconVocabSignature } from '../lib/lexiconPrefetch';
import { getNounTranslation, usesRemoteGlossFile } from '../lib/nounTranslation';
import type { Article, GoetheLevel, NounEntry, NounTranslationLang } from '../types';

const PAGE_SIZE = 80;
const WORKER_ROW_THRESHOLD = 2500;

function toLexRow(
  n: NounEntry,
  glossLang: NounTranslationLang,
  remoteGlossById: Readonly<Record<string, string>> | null,
): LexiconListRowModel {
  return {
    id: n.id,
    level: n.level,
    article: n.article,
    word: n.word,
    translation: getNounTranslation(
      n,
      glossLang,
      usesRemoteGlossFile(glossLang) ? remoteGlossById : null,
    ),
    category: n.category,
  };
}

export type LexiconDisplayState =
  | 'empty_full'
  | 'catalog_loading'
  | 'catalog_error'
  | 'filter_loading'
  | 'no_results'
  | 'ready';

export function useLexiconData(
  filter: Article | 'all',
  levelFilter: GoetheLevel | 'all',
  debouncedSearch: string,
) {
  const { nounsByLevel, totalWordCount, usingExternalLexicon } = useVocabulary();
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById } = useGlossRemote();

  const vocabSig = useMemo(() => lexiconVocabSignature(nounsByLevel), [nounsByLevel]);

  const catalogQuery = useQuery({
    queryKey: ['lexicon', 'catalog', vocabSig],
    queryFn: () => buildLexiconCatalog(nounsByLevel),
    enabled: totalWordCount > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 60 * 24 * 14,
  });

  const filteredQuery = useQuery({
    queryKey: ['lexicon', 'filtered', vocabSig, filter, levelFilter, debouncedSearch],
    queryFn: async (): Promise<LexiconFilterResult> => {
      const { rows } = catalogQuery.data!;
      const q = debouncedSearch;
      if (rows.length >= WORKER_ROW_THRESHOLD && q.trim().length >= 1) {
        try {
          return await filterLexiconInWorker({ rows, filter, levelFilter, q });
        } catch {
          return filterLexiconCatalogSync(rows, filter, levelFilter, q);
        }
      }
      return filterLexiconCatalogSync(rows, filter, levelFilter, q);
    },
    enabled: Boolean(catalogQuery.data),
    staleTime: debouncedSearch.trim() ? 30_000 : Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 30,
  });

  const sortedIds = filteredQuery.data?.sortedIds ?? [];
  const groupCounts = filteredQuery.data?.groupCounts ?? {};

  const filterStamp = filteredQuery.dataUpdatedAt;

  const infinite = useInfiniteQuery({
    queryKey: [
      'lexicon',
      'pages',
      vocabSig,
      filter,
      levelFilter,
      debouncedSearch,
      filterStamp,
      glossLang,
    ],
    initialPageParam: 0,
    enabled: filteredQuery.isSuccess,
    queryFn: ({ pageParam }) => {
      const start = pageParam as number;
      const slice = sortedIds.slice(start, start + PAGE_SIZE);
      const byId = catalogQuery.data!.byId;
      const rows: LexiconListRowModel[] = [];
      for (const id of slice) {
        const n = byId.get(id);
        if (n) rows.push(toLexRow(n, glossLang, remoteGlossById));
      }
      const next = start + slice.length < sortedIds.length ? start + slice.length : undefined;
      return { rows, nextOffset: next };
    },
    getNextPageParam: (last) => last.nextOffset,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 20,
  });

  const loadedRows = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.rows) ?? [],
    [infinite.data],
  );

  const awaitingFirstLexiconPage =
    filteredQuery.isSuccess &&
    sortedIds.length > 0 &&
    loadedRows.length === 0 &&
    !infinite.isFetched;

  const countsByArticle = useMemo(() => countArticlesInNouns(nounsByLevel), [nounsByLevel]);

  const displayState: LexiconDisplayState = useMemo(() => {
    if (totalWordCount === 0) return 'empty_full';
    if (catalogQuery.isPending && !catalogQuery.data) return 'catalog_loading';
    if (catalogQuery.isError) return 'catalog_error';
    if (catalogQuery.isFetched && filteredQuery.isPending) return 'filter_loading';
    if (filteredQuery.isSuccess && sortedIds.length === 0) return 'no_results';
    return 'ready';
  }, [
    totalWordCount,
    catalogQuery.isPending,
    catalogQuery.data,
    catalogQuery.isError,
    catalogQuery.isFetched,
    filteredQuery.isPending,
    filteredQuery.isSuccess,
    sortedIds.length,
  ]);

  return {
    totalWordCount,
    usingExternalLexicon,
    countsByArticle,
    totalFiltered: sortedIds.length,
    groupCounts,
    loadedRows,
    fetchNextPage: infinite.fetchNextPage,
    hasNextPage: infinite.hasNextPage,
    isFetchingNextPage: infinite.isFetchingNextPage,
    isCatalogPending: catalogQuery.isPending,
    isFilterPending: filteredQuery.isPending,
    awaitingFirstLexiconPage,
    displayState,
    glossLang,
    remoteGlossById,
  };
}
