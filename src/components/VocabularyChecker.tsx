import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuizProgress } from '../hooks/useQuizProgress';
import { useVocabulary } from '../context/VocabularyContext';
import { getLexiconDisplayGroup, sortLexiconGroupKeys } from '../lib/lexiconGrouping';
import type { Article, GoetheLevel } from '../types';
import { GOETHE_LEVELS } from '../types';
import { getNounTranslation, isRtlGlossLang, usesRemoteGlossFile } from '../lib/nounTranslation';
import { useGlossLanguage, useGlossRemote } from '../hooks/useGlossLanguage';

type FilterArticle = 'all' | Article;

type LexRow = {
  article: Article;
  word: string;
  translation: string;
  id: string;
  level: GoetheLevel;
  category?: string;
};

const PAGE_BG = '#08080f';
const CARD_BG = '#111120';

const artVars: Record<Article, string> = {
  der: 'var(--artikl-der)',
  die: 'var(--artikl-die)',
  das: 'var(--artikl-das)',
};

function IconBookmark({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6 4h12v17l-6-4-6 4V4z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLearned({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" fill={active ? 'currentColor' : 'none'} />
      {active ? (
        <path
          d="M8 12l2.5 2.5L16 9"
          stroke="#08080f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 12l2.5 2.5L16 9"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

type ViewMode = 'card' | 'list';
const DICT_VIEW_KEY = 'dict_view';

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(DICT_VIEW_KEY);
    if (v === 'list' || v === 'card') return v;
  } catch { /* ignore */ }
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
      className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${className} ${
        active
          ? 'border-transparent text-white'
          : 'border-[#252540] bg-[#141425] text-[#5a5a80] hover:border-[#3a3a58] hover:text-[#9b8fff]'
      }`}
    >
      {children}
    </button>
  );
}

export function VocabularyChecker() {
  const { t } = useTranslation();
  const { hardWordIds, knownWordIds, toggleHardWord, toggleKnownWord } = useQuizProgress();
  const { nounsByLevel, usingExternalLexicon } = useVocabulary();
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById } = useGlossRemote();
  const hardSet = useMemo(() => new Set(hardWordIds), [hardWordIds]);
  const knownSet = useMemo(() => new Set(knownWordIds), [knownWordIds]);

  const words = useMemo<LexRow[]>(() => {
    const out: LexRow[] = [];
    for (const level of GOETHE_LEVELS) {
      for (const n of nounsByLevel[level]) {
        out.push({
          article: n.article,
          word: n.word,
          translation: getNounTranslation(
            n,
            glossLang,
            usesRemoteGlossFile(glossLang) ? remoteGlossById : null,
          ),
          id: n.id,
          level,
          category: n.category,
        });
      }
    }
    return out;
  }, [nounsByLevel, glossLang, remoteGlossById]);

  const [filter, setFilter] = useState<FilterArticle>('all');
  const [levelFilter, setLevelFilter] = useState<GoetheLevel | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);

  useEffect(() => {
    try { localStorage.setItem(DICT_VIEW_KEY, viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      if (filter !== 'all' && w.article !== filter) return false;
      if (levelFilter !== 'all' && w.level !== levelFilter) return false;
      return true;
    });
  }, [words, filter, levelFilter]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, LexRow[]>();
    for (const w of filteredWords) {
      const key = getLexiconDisplayGroup(w.level, w.article, w.word, w.category);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.word.localeCompare(b.word, 'de'));
    }
    return map;
  }, [filteredWords]);

  const sortedGroupKeys = useMemo(
    () => sortLexiconGroupKeys([...groupedByCategory.keys()]),
    [groupedByCategory],
  );

  const countsByArticle = useMemo(() => {
    let der = 0;
    let die = 0;
    let das = 0;
    for (const w of words) {
      if (w.article === 'der') der++;
      else if (w.article === 'die') die++;
      else das++;
    }
    return { der, die, das };
  }, [words]);

  const translationHeading = t('settings.gloss_az');

  return (
    <div
      className="flex min-h-[100dvh] flex-col px-4 pb-28 pt-[max(12px,env(safe-area-inset-top))] sm:px-5 sm:pb-32 sm:pt-6"
      style={{ background: PAGE_BG, color: '#e8e8f5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <h1
          className="text-[28px] font-normal uppercase tracking-[0.08em] sm:text-[32px]"
          style={{ fontFamily: "Inter, 'DM Sans', system-ui, sans-serif", color: '#9b8fff' }}
        >
          {t('nav.lexicon')}
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: '#5a5a80' }}>
          {t('lexicon.intro')}
        </p>
        {usingExternalLexicon ? (
          <p className="mt-2 text-[12px] font-medium text-emerald-400/90">{t('lexicon.external_loaded')}</p>
        ) : null}
      </motion.div>

      {words.length > 0 ? (
        <>
          <p className="mt-5 text-[13px]" style={{ color: '#5a5a80' }}>
            {t('lexicon.total_words', {
              count: words.length,
              der: countsByArticle.der,
              die: countsByArticle.die,
              das: countsByArticle.das,
            })}
          </p>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#3a3a58' }}>
              {t('lexicon.level')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['all', ...GOETHE_LEVELS] as const).map((lv) => (
                <Chip
                  key={lv}
                  active={levelFilter === lv}
                  onClick={() => setLevelFilter(lv)}
                  className={
                    levelFilter === lv
                      ? 'bg-[#7c6cf8] ring-1 ring-[#a89ff8]/40'
                      : ''
                  }
                >
                  {lv === 'all' ? t('lexicon.all') : lv}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#3a3a58' }}>
              {t('lexicon.article')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'bg-[#252540] text-[#e8e8f5] ring-1 ring-[#3a3a58]' : ''}
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

          {/* shown count + view toggle */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: '#3a3a58' }}>
              {t('lexicon.shown', { count: filteredWords.length })}
            </p>
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'card' ? 'list' : 'card'))}
              className="flex h-8 w-8 items-center justify-center rounded-xl border transition-colors hover:bg-[#1a1a28] active:scale-[0.95]"
              style={{
                borderColor: '#252540',
                background: '#141425',
                color: viewMode === 'list' ? '#9b8fff' : '#5a5a80',
              }}
              title={viewMode === 'card' ? 'Siyahı görünüşü' : 'Kart görünüşü'}
              aria-label={viewMode === 'card' ? 'Siyahı görünüşü' : 'Kart görünüşü'}
            >
              {viewMode === 'card' ? <IconList /> : <IconGrid />}
            </button>
          </div>

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' ? (
            <div
              className="mt-4 overflow-hidden rounded-2xl border"
              style={{ borderColor: '#1c1c30', background: CARD_BG }}
            >
              {filteredWords.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: '#5a5a80' }}>
                  {t('lexicon.no_results')}
                </p>
              ) : (
                <ul>
                  {filteredWords.map((item, idx) => {
                    const known = knownSet.has(item.id);
                    const hard = hardSet.has(item.id);
                    const artColor =
                      item.article === 'der'
                        ? { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' }
                        : item.article === 'die'
                          ? { bg: 'rgba(244,63,94,0.12)', text: '#fb7185', border: 'rgba(244,63,94,0.25)' }
                          : { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.25)' };
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 px-3"
                        style={{
                          height: '52px',
                          borderBottom: idx < filteredWords.length - 1 ? '1px solid #1c1c30' : undefined,
                          background: known ? 'rgba(52,211,153,0.04)' : undefined,
                        }}
                      >
                        {/* article badge */}
                        <span
                          className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                          style={{
                            background: artColor.bg,
                            color: artColor.text,
                            border: `1px solid ${artColor.border}`,
                            minWidth: '32px',
                            textAlign: 'center',
                          }}
                        >
                          {item.article}
                        </span>

                        {/* word */}
                        <span
                          className="min-w-0 flex-1 truncate text-[15px] font-semibold"
                          style={{ color: '#e8e8f5' }}
                        >
                          {item.word}
                        </span>

                        {/* separator + translation */}
                        <span
                          className="hidden shrink-0 text-[13px] sm:inline"
                          style={{ color: '#3a3a58' }}
                        >
                          —
                        </span>
                        <span
                          className="max-w-[120px] truncate text-[13px] sm:max-w-[180px]"
                          style={{
                            color: '#5a5a80',
                            ...(isRtlGlossLang(glossLang)
                              ? { direction: 'rtl', textAlign: 'right' as const }
                              : {}),
                          }}
                        >
                          {item.translation}
                        </span>

                        {/* actions */}
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            onClick={() => toggleHardWord(item.id)}
                            className="rounded-lg p-1.5 transition-colors hover:bg-[#1a1a28]"
                            style={{ color: hard ? '#f5c842' : '#3a3a58' }}
                            title={t('lexicon.hard_bookmark_title')}
                            aria-label={t('lexicon.hard_bookmark_aria')}
                            aria-pressed={hard}
                          >
                            <IconBookmark active={hard} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleKnownWord(item.id)}
                            className="rounded-lg p-1.5 transition-colors hover:bg-[#1a1a28]"
                            style={{ color: known ? '#3ed4a0' : '#3a3a58' }}
                            title={t('lexicon.learned_title')}
                            aria-label={t('lexicon.learned_aria')}
                            aria-pressed={known}
                          >
                            <IconLearned active={known} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            /* ── CARD VIEW (original) ── */
            <>
              <div className="mt-6 space-y-10">
                {sortedGroupKeys.map((cat) => {
                  const items = groupedByCategory.get(cat) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <section key={cat} className="scroll-mt-4">
                      <h2
                        className="sticky top-0 z-[1] mb-4 border-b py-2.5 text-base font-normal uppercase tracking-[0.1em] backdrop-blur-md"
                        style={{
                          fontFamily: "Inter, 'DM Sans', system-ui, sans-serif",
                          background: `${PAGE_BG}e6`,
                          borderColor: '#1c1c30',
                          color: '#9b8fff',
                        }}
                      >
                        {cat}
                        <span
                          className="ml-2 normal-case tracking-normal"
                          style={{ fontFamily: "'DM Sans', sans-serif", color: '#5a5a80', fontSize: '13px' }}
                        >
                          ({items.length})
                        </span>
                      </h2>
                      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => {
                          const known = knownSet.has(item.id);
                          const hard = hardSet.has(item.id);
                          return (
                            <motion.li
                              key={item.id}
                              initial={false}
                              layout
                              transition={{ duration: 0.2 }}
                              className={`relative overflow-hidden rounded-[22px] border p-4 shadow-lg ${known ? 'pb-5' : ''}`}
                              style={{
                                background: CARD_BG,
                                borderColor: '#252540',
                              }}
                            >
                              {known ? (
                                <div
                                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                  style={{ background: '#3ed4a0' }}
                                  aria-hidden
                                />
                              ) : null}

                              <div className="flex items-start justify-between gap-3">
                                <span
                                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                                  style={{
                                    background: '#141425',
                                    color: '#7c6cf8',
                                    border: '0.5px solid #252540',
                                  }}
                                >
                                  {item.level}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleHardWord(item.id)}
                                    className="rounded-xl p-2 transition-colors hover:bg-[#1a1a28]"
                                    style={{
                                      color: hard ? '#f5c842' : '#5a5a80',
                                    }}
                                    title={t('lexicon.hard_bookmark_title')}
                                    aria-label={t('lexicon.hard_bookmark_aria')}
                                    aria-pressed={hard}
                                  >
                                    <IconBookmark active={hard} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleKnownWord(item.id)}
                                    className="rounded-xl p-2 transition-colors hover:bg-[#1a1a28]"
                                    style={{
                                      color: known ? '#3ed4a0' : '#5a5a80',
                                    }}
                                    title={t('lexicon.learned_title')}
                                    aria-label={t('lexicon.learned_aria')}
                                    aria-pressed={known}
                                  >
                                    <IconLearned active={known} />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 min-w-0">
                                <p
                                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                                  style={{ color: '#3a3a58' }}
                                >
                                  {t('lexicon.german')}
                                </p>
                                <p
                                  className="mt-1 leading-[1.05] tracking-wide"
                                  style={{ fontFamily: "Inter, 'DM Sans', system-ui, sans-serif" }}
                                >
                                  <span
                                    className="text-xl font-normal uppercase sm:text-2xl"
                                    style={{ color: artVars[item.article] }}
                                  >
                                    {item.article}
                                  </span>
                                  <span
                                    className="ml-2 text-3xl font-normal sm:text-[2.15rem]"
                                    style={{ color: '#e8e8f5' }}
                                  >
                                    {item.word}
                                  </span>
                                </p>
                              </div>

                              <div className="mt-3">
                                <p
                                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                                  style={{ color: '#3a3a58' }}
                                >
                                  {translationHeading}
                                </p>
                                <p
                                  className="mt-1 text-sm font-normal leading-snug"
                                  style={{
                                    color: '#5a5a80',
                                    ...(isRtlGlossLang(glossLang)
                                      ? { direction: 'rtl', textAlign: 'right' as const }
                                      : {}),
                                  }}
                                >
                                  {item.translation}
                                </p>
                              </div>
                            </motion.li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>

              {filteredWords.length === 0 && words.length > 0 ? (
                <p className="mt-10 text-center text-sm" style={{ color: '#5a5a80' }}>
                  {t('lexicon.no_results')}
                </p>
              ) : null}
            </>
          )}
        </>
      ) : (
        <p className="mt-10 text-center text-sm" style={{ color: '#5a5a80' }}>
          {t('lexicon.empty')}
        </p>
      )}
    </div>
  );
}
