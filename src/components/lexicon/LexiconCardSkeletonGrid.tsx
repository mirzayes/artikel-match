/** Lüğət yüklənərkən — kart görünüşünü təqlid edən skeletlər. */
export function LexiconCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="lex-skel flex min-h-[148px] flex-col rounded-[16px] border border-[var(--lex-border)] bg-[var(--lex-card-inner)] p-3"
          aria-hidden
        >
          <div className="flex justify-between gap-2">
            <div className="lex-skel h-5 w-12 rounded-md" />
            <div className="lex-skel h-8 w-16 rounded-lg" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="lex-skel h-3 max-w-[70%] rounded-md" />
            <div className="lex-skel h-8 w-full rounded-lg" />
          </div>
          <div className="mt-auto space-y-2 pt-3">
            <div className="lex-skel h-2 w-full rounded-full" />
            <div className="lex-skel mt-2 h-9 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
