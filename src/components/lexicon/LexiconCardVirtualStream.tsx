import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect } from 'react';
import { useLexiconScrollParent } from '../../context/LexiconScrollContext';
import type { NounTranslationLang } from '../../types';
import { LexiconCardWord, type LexiconListRowModel } from './LexiconListRow';
import type { LexiconInfiniteScrollProps } from './LexiconListVirtualRows';

export type LexiconCardFlatRow =
  | { kind: 'header'; key: string; title: string; count: number }
  | { kind: 'card'; key: string; item: LexiconListRowModel };

type LexiconCardVirtualStreamProps = {
  flatRows: LexiconCardFlatRow[];
  knownSet: ReadonlySet<string>;
  hardSet: ReadonlySet<string>;
  glossLang: NounTranslationLang;
  remoteGlossById: Readonly<Record<string, string>> | null;
  translationHeading: string;
  onToggleHard: (id: string) => void;
  onToggleKnown: (id: string) => void;
  infiniteScroll?: LexiconInfiniteScrollProps;
};

export function LexiconCardVirtualStream({
  flatRows,
  knownSet,
  hardSet,
  glossLang,
  remoteGlossById,
  translationHeading,
  onToggleHard,
  onToggleKnown,
  infiniteScroll,
}: LexiconCardVirtualStreamProps) {
  const getScrollElement = useLexiconScrollParent();

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement,
    estimateSize: (index) => (flatRows[index]?.kind === 'header' ? 48 : 196),
    overscan: 6,
  });

  useEffect(() => {
    if (!infiniteScroll) return;
    const el = getScrollElement();
    if (!el) return;
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = infiniteScroll;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight > 640) return;
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollElement, infiniteScroll]);

  const total = virtualizer.getTotalSize();

  return (
    <div
      role="list"
      className="relative mt-6 w-full"
      style={{
        height: `${total}px`,
      }}
    >
      {virtualizer.getVirtualItems().map((vi) => {
        const row = flatRows[vi.index]!;
        if (row.kind === 'header') {
          return (
            <div
              key={row.key}
              role="presentation"
              className="pointer-events-none px-0.5"
              style={{
                position: 'absolute',
                top: vi.start,
                left: 0,
                right: 0,
                height: vi.size,
                boxSizing: 'border-box',
              }}
            >
              <h2
                className="lex-word-surface-gpu border-b border-[var(--lex-border)] bg-[var(--lex-sticky-bg)] py-2 text-base font-normal uppercase tracking-[0.1em] text-[var(--lex-heading)] backdrop-blur-md"
                style={{ fontFamily: "Inter, 'DM Sans', system-ui, sans-serif" }}
              >
                {row.title}
                <span
                  className="ml-2 normal-case tracking-normal text-[13px] text-[var(--lex-muted)]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  ({row.count})
                </span>
              </h2>
            </div>
          );
        }
        const item = row.item;
        return (
          <LexiconCardWord
            key={row.key}
            as="div"
            item={item}
            isLast={false}
            known={knownSet.has(item.id)}
            hard={hardSet.has(item.id)}
            glossLang={glossLang}
            remoteGlossById={remoteGlossById}
            translationHeading={translationHeading}
            onToggleHard={onToggleHard}
            onToggleKnown={onToggleKnown}
            virtualLayout={{ top: vi.start, height: vi.size }}
          />
        );
      })}
    </div>
  );
}
