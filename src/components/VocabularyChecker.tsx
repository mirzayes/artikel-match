import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LexiconCardVirtualStream } from './lexicon/LexiconCardVirtualStream';
import { LexiconCardWord, type LexiconListRowModel } from './lexicon/LexiconListRow';
import { LexiconListVirtualRows } from './lexicon/LexiconListVirtualRows';
import { LexiconCardSkeletonGrid } from './lexicon/LexiconCardSkeletonGrid';
import { useQuizProgress } from '../hooks/useQuizProgress';
import { useVocabulary } from '../context/VocabularyContext';
import type { Article, GoetheLevel } from '../types';
import { GOETHE_LEVELS } from '../types';
import { useLexiconData } from '../hooks/useLexiconData';
import { buildLexiconCardFlatRowsFromLoaded, groupLoadedRowsForGrid } from '../lib/lexiconCardFlat';
import {
  LexiconEmptySearchState,
  LexiconSearchCombobox,
  LexiconSearchSkeletonRows,
} from './lexicon/LexiconSearchCombobox';

const POPULAR_LEX_TERMS = ['Haus', 'Zeit', 'Buch', 'Mann', 'Kind', 'Auto'] as const;

type FilterArticle = 'all' | Article;

type LexRow = LexiconListRowModel;

type ViewMode = 'card' | 'list';
const DICT_VIEW_KEY = 'dict_view';

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(DICT_VIEW_KEY);
    if (v === 'list' || v === 'card') return v;
  } catch {
    /* ignore */
  }
  return 'card';
}

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="10.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Mobil (<768px): kart rejimində virtual axın. */
function useLexCardVirtualLayout(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return narrow;
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <line x1="1" y1="4.5" x2="17" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="13.5" x2="17" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type ChipProps = { active: boolean; onClick: () => void; children: ReactNode; className?: string };

function Chip({ active, onClick, children, className = '' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lex-no-tap-highlight shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors active:scale-[0.98] ${className} ${
        active
          ? 'border-transparent text-white'
          : 'border-[var(--lex-chip-border)] bg-[var(--lex-chip-bg)] text-[var(--lex-muted)] hover:border-[var(--lex-border-strong)] hover:text-[var(--lex-accent-soft)]'
      }`}
    >
      {children}
    </button>
  );
}

export function VocabularyChecker() {
  const { t } = useTranslation();
  const { hardWordIds, knownWordIds, toggleHardWord, toggleKnownWord } = useQuizProgress();
  const { totalWordCount, usingExternalLexicon } = useVocabulary();
  const hardSet = useMemo(() => new Set(hardWordIds), [hardWordIds]);
  const knownSet = useMemo(() => new Set(knownWordIds), [knownWordIds]);

  const [filter, setFilter] = useState<FilterArticle>('all');
  const [levelFilter, setLevelFilter] = useState<GoetheLevel | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 280);
    return () => window.clearTimeout(id);
  }, [searchQuery]);
  const isSearchDebouncing = searchQuery.trim() !== debouncedSearch;

  useEffect(() => {
    try {
      localStorage.setItem(DICT_VIEW_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const {
    countsByArticle,
    totalFiltered,
    groupCounts,
    loadedRows,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    displayState,
    glossLang,
    remoteGlossById,
    awaitingFirstLexiconPage,
  } = useLexiconData(filter, levelFilter, debouncedSearch);

  const lexCardFlatRows = useMemo(
    () => buildLexiconCardFlatRowsFromLoaded(loadedRows, groupCounts),
    [loadedRows, groupCounts],
  );

  const gridSections = useMemo(
    () => groupLoadedRowsForGrid(loadedRows, groupCounts),
    [loadedRows, groupCounts],
  );

  const lexNarrowVirtual = useLexCardVirtualLayout();

  useEffect(() => {
    if (lexNarrowVirtual || viewMode !== 'card' || displayState !== 'ready') return;
    if (!hasNextPage || isFetchingNextPage) return;
    const onScroll = () => {
      const root = document.documentElement;
      const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (dist < 640) void fetchNextPage();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [
    lexNarrowVirtual,
    viewMode,
    displayState,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const infiniteScroll = useMemo(
    () =>
      displayState === 'ready' && totalFiltered > 0
        ? { hasNextPage: Boolean(hasNextPage), isFetchingNextPage, fetchNextPage }
        : undefined,
    [displayState, totalFiltered, hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const translationHeading = t('settings.gloss_az');

  const showBodySkeleton =
    (displayState === 'catalog_loading' ||
      displayState === 'filter_loading' ||
      awaitingFirstLexiconPage) &&
    !(isSearchDebouncing && searchQuery.trim());

  const hideListCardForDebounce = isSearchDebouncing && searchQuery.trim();

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[var(--lex-page-bg)] px-4 pb-[var(--app-bottom-pad,7rem)] pt-[max(12px,env(safe-area-inset-top))] text-[var(--lex-text)] sm:px-5 sm:pb-[var(--app-bottom-pad-sm,8rem)] sm:pt-6"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <h1
          className="text-[22px] font-normal uppercase tracking-[0.08em] text-[var(--lex-heading)] sm:text-[32px]"
          style={{ fontFamily: "Inter, 'DM Sans', system-ui, sans-serif" }}
        >
          {t('nav.lexicon')}
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--lex-muted)]">{t('lexicon.intro')}</p>
        {usingExternalLexicon ? (
          <p className="mt-2 text-[12px] font-medium text-emerald-400/90">{t('lexicon.external_loaded')}</p>
        ) : null}
      </motion.div>

      {totalWordCount > 0 ? (
        <>
          <LexiconSearchCombobox
            query={searchQuery}
            onQueryChange={setSearchQuery}
            popularTerms={POPULAR_LEX_TERMS}
            onPopularTerm={(term) => setSearchQuery(term)}
          >
            <p className="mt-4 text-[13px] text-[var(--lex-muted)] sm:mt-5">
              {t('lexicon.total_words', {
                count: totalWordCount,
                der: countsByArticle.der,
                die: countsByArticle.die,
                das: countsByArticle.das,
              })}
            </p>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lex-faint)]">
                {t('lexicon.level')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['all', ...GOETHE_LEVELS] as const).map((lv) => (
                  <Chip
                    key={lv}
                    active={levelFilter === lv}
                    onClick={() => setLevelFilter(lv)}
                    className={levelFilter === lv ? 'bg-[#7c6cf8] ring-1 ring-[#a89ff8]/40' : ''}
                  >
                    {lv === 'all' ? t('lexicon.all') : lv}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lex-faint)]">
                {t('lexicon.article')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={
                    filter === 'all'
                      ? 'bg-[var(--lex-hover-bg)] text-[var(--lex-heading)] ring-1 ring-[var(--lex-border-strong)]'
                      : ''
                  }
                >
                  {t('lexicon.all')}
                </Chip>
                {(['der', 'die', 'das'] as const).map((a) => (
                  <Chip
                    key={a}
                    active={filter === a}
                    onClick={() => setFilter(a)}
                    className={
                      filter === a
                        ? a === 'der'
                          ? 'bg-[#0a1628] text-[#3d8ef5] ring-1 ring-[#162a4a]'
                          : a === 'die'
                            ? 'bg-[#20091a] text-[#e06aaa] ring-1 ring-[#3d1030]'
                            : 'bg-[#061f18] text-[#3ed4a0] ring-1 ring-[#0d3528]'
                        : ''
                    }
                  >
                    {a}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--lex-faint)]">{t('lexicon.shown', { count: totalFiltered })}</p>
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'card' ? 'list' : 'card'))}
                className="lex-no-tap-highlight flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--lex-chip-border)] bg-[var(--lex-chip-bg)] transition-colors hover:bg-[var(--lex-hover-bg)] active:scale-[0.95]"
                style={{
                  color: viewMode === 'list' ? 'var(--lex-accent-soft)' : 'var(--lex-muted)',
                }}
                title={viewMode === 'card' ? 'Siyahı görünüşü' : 'Kart görünüşü'}
                aria-label={viewMode === 'card' ? 'Siyahı görünüşü' : 'Kart görünüşü'}
              >
                {viewMode === 'card' ? <IconList /> : <IconGrid />}
              </button>
            </div>

            {isSearchDebouncing && searchQuery.trim().length > 0 ? (
              <div className="mt-4">
                <LexiconSearchSkeletonRows />
              </div>
            ) : null}

            {displayState === 'catalog_error' ? (
              <p className="mt-8 text-center text-sm text-rose-400/90">{t('lexicon.load_error')}</p>
            ) : null}

            {displayState === 'no_results' && !hideListCardForDebounce ? (
              debouncedSearch ? (
                <div className="mt-6">
                  <LexiconEmptySearchState />
                </div>
              ) : (
                <p className="mt-10 text-center text-sm text-[var(--lex-muted)]">{t('lexicon.no_results')}</p>
              )
            ) : null}

            {showBodySkeleton && !hideListCardForDebounce ? (
              viewMode === 'list' ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-card-bg)] px-2 py-3">
                  <LexiconSearchSkeletonRows />
                </div>
              ) : (
                <LexiconCardSkeletonGrid count={6} />
              )
            ) : null}

            {viewMode === 'list' && !hideListCardForDebounce && displayState === 'ready' && !showBodySkeleton ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-card-bg)]">
                <LexiconListVirtualRows
                  items={loadedRows}
                  knownSet={knownSet}
                  hardSet={hardSet}
                  glossLang={glossLang}
                  remoteGlossById={remoteGlossById}
                  onToggleHard={toggleHardWord}
                  onToggleKnown={toggleKnownWord}
                  infiniteScroll={infiniteScroll}
                />
              </div>
            ) : !hideListCardForDebounce && displayState === 'ready' && !showBodySkeleton ? (
              <>
                {lexNarrowVirtual ? (
                  <LexiconCardVirtualStream
                    flatRows={lexCardFlatRows}
                    knownSet={knownSet}
                    hardSet={hardSet}
                    glossLang={glossLang}
                    remoteGlossById={remoteGlossById}
                    translationHeading={translationHeading}
                    onToggleHard={toggleHardWord}
                    onToggleKnown={toggleKnownWord}
                    infiniteScroll={infiniteScroll}
                  />
                ) : (
                  <div className="mt-6 space-y-10">
                    {gridSections.map(({ cat, items, totalInGroup }) => (
                      <section key={cat} className="scroll-mt-4">
                        <h2
                          className="sticky top-0 z-[1] mb-4 border-b border-[var(--lex-border)] bg-[var(--lex-sticky-bg)] py-2.5 text-base font-normal uppercase tracking-[0.1em] text-[var(--lex-heading)] backdrop-blur-md"
                          style={{
                            fontFamily: "Inter, 'DM Sans', system-ui, sans-serif",
                          }}
                        >
                          {cat}
                          <span
                            className="ml-2 normal-case tracking-normal text-[13px] text-[var(--lex-muted)]"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            ({totalInGroup})
                          </span>
                        </h2>
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {items.map((item: LexRow) => (
                            <LexiconCardWord
                              key={item.id}
                              item={item}
                              isLast={false}
                              known={knownSet.has(item.id)}
                              hard={hardSet.has(item.id)}
                              glossLang={glossLang}
                              remoteGlossById={remoteGlossById}
                              translationHeading={translationHeading}
                              onToggleHard={toggleHardWord}
                              onToggleKnown={toggleKnownWord}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </LexiconSearchCombobox>
        </>
      ) : (
        <p className="mt-10 text-center text-sm text-[var(--lex-muted)]">{t('lexicon.empty')}</p>
      )}
    </div>
  );
}
