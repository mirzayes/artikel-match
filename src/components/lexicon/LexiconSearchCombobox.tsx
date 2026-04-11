import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LexiconScrollProvider } from '../../context/LexiconScrollContext';

const LEX_HINT_LANG_KEY = 'artikel-lex-hint-lang';

function readHintLang(): 'az' | 'de' {
  try {
    const v = sessionStorage.getItem(LEX_HINT_LANG_KEY);
    if (v === 'de' || v === 'az') return v;
  } catch {
    /* ignore */
  }
  return 'az';
}

function writeHintLang(l: 'az' | 'de') {
  try {
    sessionStorage.setItem(LEX_HINT_LANG_KEY, l);
  } catch {
    /* ignore */
  }
}

function useIsMobileSearchLayout(): boolean {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

type LexiconSearchComboboxProps = {
  query: string;
  onQueryChange: (q: string) => void;
  popularTerms: readonly string[];
  onPopularTerm: (term: string) => void;
  /** Məzmun: filtrlər + nəticələr (scroll daxilində) */
  children: ReactNode;
};

export function LexiconSearchCombobox({
  query,
  onQueryChange,
  popularTerms,
  onPopularTerm,
  children,
}: LexiconSearchComboboxProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobileSearchLayout();
  const [expanded, setExpanded] = useState(false);
  const pushedRef = useRef(false);
  /** Mobil tam ekran axtarış açıq olanda popstate ilə bağlamaq üçün */
  const searchOverlayActiveRef = useRef(false);
  const lexScrollParentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hintLang, setHintLangState] = useState<'az' | 'de'>(() => readHintLang());

  const setHintLang = useCallback((l: 'az' | 'de') => {
    setHintLangState(l);
    writeHintLang(l);
  }, []);

  const openExpanded = useCallback(() => {
    if (!isMobile) return;
    searchOverlayActiveRef.current = true;
    setExpanded(true);
    if (!pushedRef.current) {
      try {
        window.history.pushState({ artikelLexSearch: 1 }, '');
        pushedRef.current = true;
      } catch {
        /* ignore */
      }
    }
  }, [isMobile]);

  const closeExpanded = useCallback(() => {
    inputRef.current?.blur();
    if (pushedRef.current) {
      try {
        window.history.back();
      } catch {
        pushedRef.current = false;
        searchOverlayActiveRef.current = false;
        setExpanded(false);
      }
    } else {
      searchOverlayActiveRef.current = false;
      setExpanded(false);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!searchOverlayActiveRef.current) return;
      searchOverlayActiveRef.current = false;
      pushedRef.current = false;
      setExpanded(false);
      inputRef.current?.blur();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!isMobile && expanded) {
      searchOverlayActiveRef.current = false;
      setExpanded(false);
      pushedRef.current = false;
    }
  }, [isMobile, expanded]);

  const placeholder =
    hintLang === 'de' ? t('lexicon.search_placeholder_de') : t('lexicon.search_placeholder_az');

  const searchBlock = (
    <div className="lex-no-tap-highlight w-full max-w-[min(100%,480px)] space-y-3">
      <div className="flex items-center gap-2">
        {expanded ? (
          <button
            type="button"
            onClick={() => closeExpanded()}
            className="lex-no-tap-highlight flex h-[54px] w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-chip-bg)] text-lg text-[var(--lex-heading)] transition-colors active:bg-[var(--lex-hover-bg)]"
            aria-label={t('lexicon.search_close')}
          >
            ←
          </button>
        ) : null}
        <div className="relative min-w-0 flex-1">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lex-faint)]"
            aria-hidden
          >
            ⌕
          </span>
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => openExpanded()}
            placeholder={placeholder}
            className="lex-combobox-input w-full min-h-[54px] rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-card-bg)] py-3 pl-11 pr-4 text-[16px] leading-snug text-[var(--lex-heading)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--lex-faint)] focus:border-[var(--lex-accent-soft)] focus:ring-2 focus:ring-[var(--lex-accent-soft)]/25"
          />
        </div>
        <button
          type="button"
          onClick={() => setHintLang(hintLang === 'az' ? 'de' : 'az')}
          className="lex-no-tap-highlight flex h-[54px] min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-chip-bg)] px-2 text-[12px] font-bold tabular-nums text-[var(--lex-muted)] transition-colors active:scale-[0.96] active:bg-[var(--lex-hover-bg)]"
          title={t('lexicon.hint_lang_toggle_title')}
          aria-label={t('lexicon.hint_lang_toggle_title')}
        >
          {hintLang === 'az' ? 'AZ' : 'DE'}
        </button>
      </div>

      <div>
        <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lex-faint)]">
          {t('lexicon.quick_chips_title')}
        </p>
        <div className="lex-quick-chips -mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
          {popularTerms.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                onPopularTerm(term);
                inputRef.current?.focus();
              }}
              className="lex-no-tap-highlight shrink-0 rounded-full border border-[var(--lex-border)] bg-[var(--lex-chip-bg)] px-4 py-2.5 text-[14px] font-semibold text-[var(--lex-heading)] shadow-sm transition-colors active:scale-[0.97] active:border-[var(--lex-accent-soft)] active:bg-[var(--lex-hover-bg)]"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile && expanded) {
    return (
      <div
        data-lex-search-overlay="1"
        className="fixed inset-0 z-[100] flex flex-col bg-[var(--lex-page-bg)] pt-[max(8px,env(safe-area-inset-top))]"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.lexicon')}
      >
        <div className="shrink-0 border-b border-[var(--lex-border)] px-3 pb-3 pt-1">
          {searchBlock}
        </div>
        <LexiconScrollProvider scrollRef={lexScrollParentRef}>
          <div
            ref={lexScrollParentRef}
            className="lex-combobox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            {children}
          </div>
        </LexiconScrollProvider>
      </div>
    );
  }

  return (
    <LexiconScrollProvider scrollRef={lexScrollParentRef}>
      <div className="w-full max-w-[min(100%,480px)] space-y-3">
        {searchBlock}
        {children}
      </div>
    </LexiconScrollProvider>
  );
}

export function LexiconSearchSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <ul className="mt-3 space-y-0 overflow-hidden rounded-2xl border border-[var(--lex-border)] bg-[var(--lex-card-bg)]">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-[var(--lex-border)] px-3 py-3 last:border-b-0"
          style={{ minHeight: 52 }}
        >
          <div className="lex-skel h-6 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="lex-skel h-4 w-[45%] max-w-[140px] rounded-md" />
            <div className="lex-skel h-3 w-[70%] max-w-[220px] rounded-md opacity-70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LexiconEmptySearchState() {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[var(--lex-border-strong)] bg-[var(--lex-card-inner)] px-4 py-8 text-center">
      <p className="text-[15px] font-semibold leading-relaxed text-[var(--lex-heading)]">
        {t('lexicon.empty_search_title_az')}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--lex-muted)]">{t('lexicon.empty_search_body_az')}</p>
      <hr className="my-5 border-[var(--lex-border)]" />
      <p className="text-[15px] font-semibold leading-relaxed text-[var(--lex-heading)]">
        {t('lexicon.empty_search_title_de')}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--lex-muted)]">{t('lexicon.empty_search_body_de')}</p>
    </div>
  );
}
