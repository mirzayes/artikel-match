import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect } from 'react';
import { useLexiconScrollParent } from '../../context/LexiconScrollContext';
import type { NounTranslationLang } from '../../types';
import { LexiconListRow, type LexiconListRowModel } from './LexiconListRow';

const ROW_PX = 52;

export type LexiconInfiniteScrollProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

type LexiconListVirtualRowsProps = {
  items: LexiconListRowModel[];
  knownSet: ReadonlySet<string>;
  hardSet: ReadonlySet<string>;
  glossLang: NounTranslationLang;
  remoteGlossById: Readonly<Record<string, string>> | null;
  onToggleHard: (id: string) => void;
  onToggleKnown: (id: string) => void;
  /** Siyahı sonuna yaxınlaşanda növbəti səhifəni yüklə. */
  infiniteScroll?: LexiconInfiniteScrollProps;
};

export function LexiconListVirtualRows({
  items,
  knownSet,
  hardSet,
  glossLang,
  remoteGlossById,
  onToggleHard,
  onToggleKnown,
  infiniteScroll,
}: LexiconListVirtualRowsProps) {
  const getScrollElement = useLexiconScrollParent();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: () => ROW_PX,
    overscan: 14,
  });

  useEffect(() => {
    if (!infiniteScroll) return;
    const el = getScrollElement();
    if (!el) return;
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = infiniteScroll;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight > 520) return;
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollElement, infiniteScroll]);

  const total = virtualizer.getTotalSize();

  return (
    <ul className="relative m-0 list-none p-0" style={{ height: `${total}px` }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const item = items[vi.index]!;
        const isLast = vi.index === items.length - 1;
        return (
          <LexiconListRow
            key={item.id}
            item={item}
            isLast={isLast}
            known={knownSet.has(item.id)}
            hard={hardSet.has(item.id)}
            glossLang={glossLang}
            remoteGlossById={remoteGlossById}
            onToggleHard={onToggleHard}
            onToggleKnown={onToggleKnown}
            virtualLayout={{ top: vi.start, height: vi.size }}
          />
        );
      })}
    </ul>
  );
}
