interface MasteryRingProps {
  fraction: number;
  mastered: number;
  total: number;
  caption: string;
}

const R = 52;
const STROKE = 8;
const C = 2 * Math.PI * R;

export function MasteryRing({ fraction, mastered, total, caption }: MasteryRingProps) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const dashOffset = C * (1 - clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[148px] w-[148px]">
        <svg
          width={148}
          height={148}
          viewBox="0 0 148 148"
          className="-rotate-90"
          aria-hidden
        >
          <defs>
            <linearGradient id="masteryRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b7cff" />
              <stop offset="55%" stopColor="#5eead4" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle
            cx="74"
            cy="74"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={STROKE}
          />
          <circle
            cx="74"
            cy="74"
            r={R}
            fill="none"
            stroke="url(#masteryRingGrad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-artikl-text/35">
            {caption}
          </p>
          <p className="mt-1 font-display text-[1.65rem] font-bold leading-none tabular-nums text-artikl-text">
            {mastered}
            <span className="text-base font-semibold text-artikl-text/45"> / {total}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
