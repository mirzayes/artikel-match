import { motion } from 'framer-motion';

type LevelMasteryProgressBarProps = {
  mastered: number;
  total: number;
  className?: string;
};

/**
 * «Mənimsənilib X / Y» altında — spring doldurma, hərəkət edən parıltı, 100% olduqda xarici işıq.
 */
export function LevelMasteryProgressBar({ mastered, total, className = '' }: LevelMasteryProgressBarProps) {
  const safeTotal = Math.max(0, total);
  const safeMastered = Math.max(0, mastered);
  const pct = safeTotal > 0 ? Math.min(100, (safeMastered / safeTotal) * 100) : 0;
  const isComplete = safeTotal > 0 && safeMastered >= safeTotal;

  return (
    <div
      className={['relative mx-auto w-full max-w-[min(100%,320px)]', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={safeMastered}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-label={`Mənimsənilib ${safeMastered} / ${safeTotal}`}
    >
      {isComplete ? (
        <motion.div
          className="pointer-events-none absolute -left-1 -right-1 -top-2 -bottom-2 rounded-full bg-gradient-to-r from-violet-500/35 via-emerald-400/30 to-cyan-400/35 blur-lg"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.95, 0.45] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      <div className="learning-level-mastery-track relative h-[7px] overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.08]">
        <motion.div
          className="absolute left-0 top-0 h-full overflow-hidden rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 0.8 }}
        >
          <div className="relative h-full w-full min-w-[4px]">
            <motion.div
              className="learning-level-mastery-fill absolute inset-0 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#a78bfa] to-[#34d399]"
              initial={false}
              animate={{
                boxShadow: isComplete
                  ? '0 0 14px 2px rgba(167,139,250,0.55), 0 0 26px 5px rgba(52,211,153,0.4), inset 0 1px 0 rgba(255,255,255,0.35)'
                  : '0 0 11px 2px rgba(167,139,250,0.38), inset 0 1px 0 rgba(255,255,255,0.28)',
              }}
              transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            />
            {pct > 0 ? (
              <motion.div
                className="pointer-events-none absolute top-0 bottom-0 w-[42%] max-w-[100px] bg-gradient-to-r from-transparent via-white/55 to-transparent"
                aria-hidden
                initial={{ x: '-100%' }}
                animate={{ x: ['-120%', '280%'] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 0.45,
                }}
                style={{ left: 0, willChange: 'transform' }}
              />
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
