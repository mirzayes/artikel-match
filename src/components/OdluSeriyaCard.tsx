import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { OdluSeriyaState } from '../lib/odluStreak';

interface OdluSeriyaCardProps {
  odlu: OdluSeriyaState;
}

export function OdluSeriyaCard({ odlu }: OdluSeriyaCardProps) {
  const { t } = useTranslation();
  const { streak, correctToday, goal, metToday, atRisk } = odlu;
  const pct = Math.min(100, Math.round((correctToday / goal) * 100));

  const fireActive = metToday;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'glass-card relative overflow-hidden rounded-2xl border p-5 sm:p-6',
        fireActive
          ? 'border-orange-400/35 shadow-[0_0_48px_-12px_rgba(251,146,60,0.45)]'
          : atRisk
            ? 'border-white/[0.1] shadow-none'
            : 'border-white/[0.08]',
      ].join(' ')}
    >
      {fireActive ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 80% -10%, rgba(251, 146, 60, 0.95), transparent 55%)',
          }}
        />
      ) : null}

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-4">
          <span
            className="select-none text-5xl leading-none sm:text-6xl"
            style={{
              filter: fireActive
                ? 'drop-shadow(0 0 18px rgba(251, 146, 60, 0.95)) saturate(1.2)'
                : 'grayscale(1) brightness(0.75) opacity(0.42)',
              transform: fireActive ? 'scale(1.06)' : 'scale(0.96)',
            }}
            aria-hidden
          >
            🔥
          </span>
          <div>
            <p className="gamify-block-title gamify-block-title--warm">ODLU SERİYA</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p className="font-display text-4xl font-bold tabular-nums text-artikl-text sm:text-5xl">{streak}</p>
              {streak > 3 ? (
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-300/95">
                  {t('rewards.odlu_streak_artik_bonus')}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-[240px]">
          <div className="flex items-center justify-end gap-2 text-[11px] font-semibold tabular-nums text-artikl-muted2">
            <span>
              {correctToday}/{goal}
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={correctToday}
            aria-label={`Günlük düzgün cavab ${correctToday} / ${goal}`}
          >
            <div
              className={[
                'h-full rounded-full transition-[width] duration-500 ease-out',
                fireActive
                  ? 'bg-gradient-to-r from-[#EA580C] via-orange-600 to-red-500 shadow-[0_0_12px_rgba(234,88,12,0.45)]'
                  : atRisk
                    ? 'bg-gradient-to-r from-stone-500 to-stone-600'
                    : 'bg-gradient-to-r from-stone-600 to-stone-700',
              ].join(' ')}
              style={{ width: `${pct}%` }}
            />
          </div>
          {metToday ? (
            <p className="mt-2 text-center text-sm font-semibold text-[#1A1A2E] dark:text-orange-200/95 sm:text-left">
              Gündəlik hədəf tamamlandı!
            </p>
          ) : atRisk ? (
            <p className="mt-2 text-center text-xs text-artikl-caption sm:text-left">Seriya riskində.</p>
          ) : (
            <p className="mt-2 text-center text-xs text-artikl-caption sm:text-left">
              Gündəlik hədəf: {goal} düzgün
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
