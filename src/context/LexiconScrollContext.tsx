import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react';

/** Возвращает элемент, который скроллится (оверлей Lüğət və ya `document.documentElement`). */
export type LexiconScrollParentGetter = () => HTMLElement | null;

const LexiconScrollContext = createContext<LexiconScrollParentGetter | null>(null);

export function LexiconScrollProvider({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const getter = useMemo<LexiconScrollParentGetter>(
    () => () =>
      scrollRef.current ??
      (typeof document !== 'undefined' ? document.documentElement : null),
    [scrollRef],
  );
  return <LexiconScrollContext.Provider value={getter}>{children}</LexiconScrollContext.Provider>;
}

export function useLexiconScrollParent(): LexiconScrollParentGetter {
  const ctx = useContext(LexiconScrollContext);
  return (
    ctx ??
    (() => (typeof document !== 'undefined' ? document.documentElement : null))
  );
}
