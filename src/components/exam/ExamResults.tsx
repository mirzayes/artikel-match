import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ExamResultsProps {
  correct: number;
  total: number;
  xpGained: number;
  onAgain: () => void;
  onHome: () => void;
}

function ConfettiLayer({ show }: { show: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + (i % 7) * 11) % 100}%`,
        delay: (i % 12) * 0.04,
        duration: 2.2 + (i % 5) * 0.15,
        hue: (i * 47) % 360,
        xDrift: (i % 2 === 0 ? 1 : -1) * (20 + (i % 8) * 8),
      })),
    [],
  );

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block h-2 w-2 rounded-sm"
          style={{
            left: p.left,
            backgroundColor: `hsl(${p.hue} 85% 60%)`,
            boxShadow: `0 0 6px hsl(${p.hue} 90% 55%)`,
          }}
          initial={{ y: -12, opacity: 1, rotate: 0, x: 0 }}
          animate={{
            y: 920,
            opacity: [1, 1, 0.95, 0],
            rotate: p.xDrift * 2,
            x: p.xDrift,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 0.61, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
}

export function ExamResults({ correct, total, xpGained, onAgain, onHome }: ExamResultsProps) {
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const perfect = total > 0 && correct === total;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-36 pt-[max(12px,env(safe-area-inset-top))] text-stone-200 sm:px-6">
      <ConfettiLayer show={perfect} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md pt-6"
      >
        <h1 className="text-center font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
          Yekun Nəticə
        </h1>

        {perfect ? (
          <motion.p
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="mt-4 text-center text-xl font-bold text-transparent sm:text-2xl"
            style={{
              backgroundImage: 'linear-gradient(90deg, #c4b5fd, #e879f9, #fcd34d)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            Mükəmməl!
          </motion.p>
        ) : null}

        <div className="glass-card mt-8 rounded-2xl p-6 sm:p-8">
          <div className="grid gap-4 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.45)]">
                Dəqiqlik (bu sınaq)
              </p>
              <p className="mt-1 font-sans text-4xl font-bold tabular-nums text-white">{pct}%</p>
              <p className="mt-1 text-sm text-[rgba(232,232,245,0.55)]">
                {correct} / {total} düzgün
              </p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.45)]">
                Qazanılan XP
              </p>
              <p className="mt-1 font-sans text-3xl font-bold tabular-nums text-violet-300">+{xpGained} XP</p>
              <p className="mt-1 text-xs text-[rgba(232,232,245,0.45)]">Sınaqda ikiqat XP</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAgain}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-600 py-4 text-[15px] font-semibold text-white shadow-lg shadow-violet-900/25 transition-transform active:scale-[0.98]"
          >
            Yeni sınaq
          </button>
          <button
            type="button"
            onClick={onHome}
            className="w-full rounded-2xl border border-white/14 bg-white/5 py-3.5 text-sm font-semibold text-[rgba(232,232,245,0.75)] transition-colors hover:bg-white/10"
          >
            Ana səhifə
          </button>
        </div>
      </motion.div>
    </div>
  );
}
