import { forwardRef, type ReactNode } from 'react';

interface FeedbackBarProps {
  ok: boolean;
  /** Yalnız düzgün cavabda göstərilir */
  fact?: string | null;
  children: ReactNode;
}

export const FeedbackBar = forwardRef<HTMLDivElement, FeedbackBarProps>(function FeedbackBar(
  { ok, fact, children },
  ref,
) {
  const showFact = Boolean(ok && fact);

  return (
    <div ref={ref} className={`artikl-feedback ${ok ? 'artikl-fb-ok' : 'artikl-fb-bad'}`}>
      <div className="artikl-fb-top">
        <div className="artikl-fb-icon" aria-hidden>
          {ok ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <polyline
                points="1.5,5 4,7.5 8.5,2"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="2" y1="2" x2="8" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="2" x2="2" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div className="artikl-fb-text">{children}</div>
      </div>
      {showFact ? (
        <div className="artikl-fb-fact">
          <span className="artikl-fb-fact-dot" aria-hidden>
            ✦
          </span>
          <span>{fact}</span>
        </div>
      ) : null}
    </div>
  );
});
