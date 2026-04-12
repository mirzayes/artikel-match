import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OdluSeriyaState } from '../lib/odluStreak';

/** Qısa yüksək ton — streak artanda (Web Audio API). */
function playStreakBeep(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, ctx.currentTime);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
    osc.start(t0);
    osc.stop(t0 + 0.095);
    void ctx.resume().then(() => {
      window.setTimeout(() => void ctx.close().catch(() => {}), 180);
    });
  } catch {
    /* brauzer / siyasət */
  }
}

interface OdluSeriyaCardProps {
  odlu: OdluSeriyaState;
}

export function OdluSeriyaCard({ odlu }: OdluSeriyaCardProps) {
  const { t } = useTranslation();
  const { streak, correctToday, goal, metToday, atRisk } = odlu;
  const pct = Math.min(100, Math.round((correctToday / goal) * 100));

  const fireActive = metToday;

  const prevStreakRef = useRef<number | null>(null);
  const [fxKey, setFxKey] = useState(0);
  const [streakNumberPulse, setStreakNumberPulse] = useState(false);

  useEffect(() => {
    const prev = prevStreakRef.current;
    if (prev !== null && streak > prev) {
      setFxKey((k) => k + 1);
      playStreakBeep();
      setStreakNumberPulse(true);
      const id = window.setTimeout(() => setStreakNumberPulse(false), 650);
      prevStreakRef.current = streak;
      return () => clearTimeout(id);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  const fireScaleIdle = fireActive ? 1.06 : 0.96;
  const fireFilterActive = 'drop-shadow(0 0 18px rgba(251, 146, 60, 0.95)) saturate(1.2)';
  const fireFilterIdle = 'grayscale(1) brightness(0.75) opacity(0.42)';

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
        <div className="relative flex items-center gap-4">
          <motion.span
            key={`odlu-fire-${streak}-${fxKey}`}
            className="inline-block select-none text-5xl leading-none sm:text-6xl"
            initial={{
              scale: fireScaleIdle,
              filter: fireActive ? fireFilterActive : fireFilterIdle,
            }}
            animate={
              fxKey > 0
                ? {
                    scale: [fireScaleIdle, 1.5, 1],
                    filter: fireActive ? fireFilterActive : fireFilterIdle,
                  }
                : {
                    scale: fireScaleIdle,
                    filter: fireActive ? fireFilterActive : fireFilterIdle,
                  }
            }
            transition={
              fxKey > 0
                ? { duration: 0.62, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.28 }
            }
            aria-hidden
          >
            🔥
          </motion.span>

          {fxKey > 0 ? (
            <motion.span
              key={fxKey}
              className="pointer-events-none absolute left-[2.25rem] top-[-0.25rem] z-10 text-sm font-black tracking-tight text-orange-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:left-[2.75rem] sm:text-base"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, -6, -56] }}
              transition={{ duration: 0.95, times: [0, 0.08, 0.28, 1], ease: 'easeOut' }}
            >
              +1 streak!
            </motion.span>
          ) : null}

          <div>
            <p className="gamify-block-title gamify-block-title--warm">ODLU SERİYA</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <motion.p
                className={[
                  'font-display tabular-nums text-artikl-text transition-[font-size,font-weight,transform] duration-500 ease-out',
                  streakNumberPulse
                    ? 'text-5xl font-black sm:text-6xl scale-105'
                    : 'text-4xl font-bold sm:text-5xl',
                ].join(' ')}
              >
                {streak}
              </motion.p>
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
