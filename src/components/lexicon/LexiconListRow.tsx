import type { Article, GoetheLevel, NounEntry, NounTranslationLang } from '../../types';
import { getNounTranslation, isRtlGlossLang, usesRemoteGlossFile } from '../../lib/nounTranslation';
import { SpeakWordButton } from '../SpeakWordButton';
import { useTranslation } from 'react-i18next';

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
          stroke="var(--lex-page-bg)"
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

export type LexiconListRowModel = {
  article: Article;
  word: string;
  translation: string;
  id: string;
  level: GoetheLevel;
  category?: string;
};

function toNounEntry(item: LexiconListRowModel): NounEntry {
  return {
    id: item.id,
    level: item.level,
    article: item.article,
    word: item.word,
    translation: item.translation,
    category: item.category,
  };
}

type LexiconListRowProps = {
  item: LexiconListRowModel;
  isLast: boolean;
  known: boolean;
  hard: boolean;
  glossLang: NounTranslationLang;
  remoteGlossById: Readonly<Record<string, string>> | null;
  onToggleHard: (id: string) => void;
  onToggleKnown: (id: string) => void;
  /** Virtual siyahı: `ul` içində absolute mövqe. */
  virtualLayout?: { top: number; height: number };
};

/** Siyahı rejimi: sabit hündürlük — virtualizer ilə uyğun. */
export function LexiconListRow({
  item,
  isLast,
  known,
  hard,
  glossLang,
  remoteGlossById,
  onToggleHard,
  onToggleKnown,
  virtualLayout,
}: LexiconListRowProps) {
  const { t } = useTranslation();
  const translation = getNounTranslation(
    toNounEntry(item),
    glossLang,
    usesRemoteGlossFile(glossLang) ? remoteGlossById : null,
  );
  const artColor =
    item.article === 'der'
      ? { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' }
      : item.article === 'die'
        ? { bg: 'rgba(244,63,94,0.12)', text: '#fb7185', border: 'rgba(244,63,94,0.25)' }
        : { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.25)' };

  return (
    <li
      className="lex-list-row-press lex-no-tap-highlight lex-word-surface-gpu flex items-center gap-3 px-3 transition-colors"
      style={{
        height: virtualLayout?.height ?? 52,
        minHeight: virtualLayout?.height ?? 52,
        borderBottom: isLast ? undefined : '1px solid var(--lex-border)',
        background: known ? 'rgba(52,211,153,0.04)' : undefined,
        ...(virtualLayout
          ? {
              position: 'absolute',
              top: virtualLayout.top,
              left: 0,
              right: 0,
              width: '100%',
            }
          : {}),
      }}
    >
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

      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: 'var(--lex-heading)' }}>
        {item.word}
      </span>
      <SpeakWordButton word={item.word} className="text-[14px]" />

      <span className="hidden shrink-0 text-[13px] sm:inline" style={{ color: 'var(--lex-faint)' }}>
        —
      </span>
      <span
        className="max-w-[120px] truncate text-[13px] sm:max-w-[180px]"
        style={{
          color: 'var(--lex-muted)',
          ...(isRtlGlossLang(glossLang) ? { direction: 'rtl', textAlign: 'right' as const } : {}),
        }}
      >
        {translation}
      </span>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => onToggleHard(item.id)}
          className="lex-no-tap-highlight rounded-lg p-1.5 transition-colors hover:bg-[var(--lex-hover-bg)] active:opacity-80"
          style={{ color: hard ? '#7C3AED' : 'var(--lex-faint)' }}
          title={t('lexicon.hard_bookmark_title')}
          aria-label={t('lexicon.hard_bookmark_aria')}
          aria-pressed={hard}
        >
          <IconBookmark active={hard} />
        </button>
        <button
          type="button"
          onClick={() => onToggleKnown(item.id)}
          className="lex-no-tap-highlight rounded-lg p-1.5 transition-colors hover:bg-[var(--lex-hover-bg)] active:opacity-80"
          style={{ color: known ? '#3ed4a0' : 'var(--lex-faint)' }}
          title={t('lexicon.learned_title')}
          aria-label={t('lexicon.learned_aria')}
          aria-pressed={known}
        >
          <IconLearned active={known} />
        </button>
      </div>
    </li>
  );
}

export function LexiconCardWord({
  item,
  known,
  hard,
  glossLang,
  remoteGlossById,
  translationHeading,
  onToggleHard,
  onToggleKnown,
  virtualLayout,
  as: Tag = 'li',
}: LexiconListRowProps & {
  translationHeading: string;
  virtualLayout?: { top: number; height: number };
  /** Virtual axında `div` + `role="listitem"` */
  as?: 'li' | 'div';
}) {
  const { t } = useTranslation();
  const translation = getNounTranslation(
    toNounEntry(item),
    glossLang,
    usesRemoteGlossFile(glossLang) ? remoteGlossById : null,
  );

  return (
    <Tag
      className="lex-list-row-press lex-no-tap-highlight lex-word-card-surface lex-word-surface-gpu relative overflow-hidden rounded-[22px] border p-4 shadow-lg transition-colors"
      role={Tag === 'div' ? 'listitem' : undefined}
      style={{
        background: 'var(--lex-card-inner)',
        borderColor: 'var(--lex-chip-border)',
        paddingBottom: known ? '1.35rem' : undefined,
        ...(virtualLayout
          ? {
              position: 'absolute',
              top: virtualLayout.top,
              left: 0,
              right: 0,
              width: '100%',
              minHeight: virtualLayout.height,
              boxSizing: 'border-box',
            }
          : {}),
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
            background: 'var(--lex-level-pill-bg)',
            color: '#7c6cf8',
            border: '0.5px solid var(--lex-level-pill-border)',
          }}
        >
          {item.level}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onToggleHard(item.id)}
            className="lex-no-tap-highlight rounded-xl p-2 transition-colors hover:bg-[var(--lex-hover-bg)] active:opacity-80"
            style={{ color: hard ? '#7C3AED' : 'var(--lex-muted)' }}
            title={t('lexicon.hard_bookmark_title')}
            aria-label={t('lexicon.hard_bookmark_aria')}
            aria-pressed={hard}
          >
            <IconBookmark active={hard} />
          </button>
          <button
            type="button"
            onClick={() => onToggleKnown(item.id)}
            className="lex-no-tap-highlight rounded-xl p-2 transition-colors hover:bg-[var(--lex-hover-bg)] active:opacity-80"
            style={{ color: known ? '#3ed4a0' : 'var(--lex-muted)' }}
            title={t('lexicon.learned_title')}
            aria-label={t('lexicon.learned_aria')}
            aria-pressed={known}
          >
            <IconLearned active={known} />
          </button>
        </div>
      </div>

      <div className="mt-3 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lex-faint)]">{t('lexicon.german')}</p>
        <div
          className="mt-1 flex flex-wrap items-center gap-2 leading-[1.05] tracking-wide"
          style={{ fontFamily: "Inter, 'DM Sans', system-ui, sans-serif" }}
        >
          <p className="m-0 min-w-0">
            <span className="text-xl font-normal uppercase sm:text-2xl" style={{ color: artVars[item.article] }}>
              {item.article}
            </span>
            <span className="ml-2 text-3xl font-normal sm:text-[2.15rem]" style={{ color: 'var(--lex-heading)' }}>
              {item.word}
            </span>
          </p>
          <SpeakWordButton word={item.word} className="text-[1.35rem] sm:text-2xl" />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lex-faint)]">{translationHeading}</p>
        <p
          className="mt-1 text-sm font-normal leading-snug text-[var(--lex-muted)]"
          style={{
            ...(isRtlGlossLang(glossLang) ? { direction: 'rtl', textAlign: 'right' as const } : {}),
          }}
        >
          {translation}
        </p>
      </div>
    </Tag>
  );
}
