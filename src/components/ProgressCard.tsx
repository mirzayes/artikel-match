import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ProgressCardProps {
  title: string;
  /** Əgər `valueNode` verilməyibsə göstərilir */
  value?: string;
  valueNode?: ReactNode;
  subtitle?: string;
  accentClass: string;
  delay?: number;
  variant?: 'light' | 'dark';
  /** Əsas oyun metrikaları — daha böyük, parlaq kart */
  highlight?: 'xp' | 'streak';
  /** 0…total vizuallaşdırması (məs. mənimsənilmiş sözlər) */
  progress?: { current: number; total: number };
}

export function ProgressCard({
  title,
  value,
  valueNode,
  subtitle,
  accentClass,
  delay = 0,
  variant = 'dark',
  highlight,
  progress,
}: ProgressCardProps) {
  const heroShell =
    highlight === 'xp'
      ? 'border border-indigo-400/25 shadow-[0_0_44px_-10px_rgba(99,102,241,0.45)]'
      : highlight === 'streak'
        ? 'border border-amber-400/22 shadow-[0_0_44px_-10px_rgba(245,158,11,0.32)]'
        : '';

  const shell = [
    variant === 'dark'
      ? `glass-card rounded-2xl shadow-none ${highlight ? 'p-7 sm:p-9' : 'p-6 sm:p-8'}`
      : 'rounded-2xl border border-stone-200/70 bg-white/92 p-6 shadow-card backdrop-blur-xl sm:p-8',
    heroShell,
  ]
    .filter(Boolean)
    .join(' ');
  const subC = variant === 'dark' ? 'text-artikl-caption' : 'text-stone-500';

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden ${shell}`}
    >
      <div
        className={`absolute left-0 top-0 w-full opacity-95 ${highlight ? 'h-1' : 'h-0.5'} ${accentClass}`}
      />
      <p className={`gamify-block-title ${highlight ? 'tracking-[0.12em]' : ''}`}>{title}</p>
      <div className="mt-2">
        {valueNode ?? (
          <p
            className={`stat-value font-sans font-bold tracking-tight tabular-nums ${
              highlight
                ? variant === 'dark'
                  ? 'text-3xl text-artikl-text sm:text-4xl'
                  : 'text-3xl text-stone-900 sm:text-4xl'
                : variant === 'dark'
                  ? 'text-2xl font-semibold sm:text-[1.75rem]'
                  : 'text-2xl font-semibold sm:text-[1.75rem] text-stone-900'
            }`}
          >
            {value}
          </p>
        )}
      </div>
      {subtitle ? <p className={`mt-2 text-sm leading-snug ${subC}`}>{subtitle}</p> : null}
      {progress != null && progress.total > 0 ? (
        <div className="mt-4">
          <div
            className={`h-1.5 w-full overflow-hidden rounded-full ${
              variant === 'dark' ? '' : 'bg-stone-200/90'
            }`}
            style={variant === 'dark' ? { background: 'rgba(255,255,255,0.08)' } : undefined}
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={`${progress.current} / ${progress.total}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                variant === 'dark' ? 'bg-emerald-400/75' : 'bg-emerald-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`mt-1.5 text-xs tabular-nums ${subC}`}>
            {progress.current} / {progress.total} ({pct}%)
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
