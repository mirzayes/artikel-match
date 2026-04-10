import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMilestoneFanfare } from '../lib/answerFeedbackMedia';
import { useGameStore } from '../store/useGameStore';

type BurstCoin = { id: number; tx: number; ty: number; rot: number; delay: number; scale: number };

export function MilestoneOverlay() {
  const { t } = useTranslation();
  const until = useGameStore((s) => s.goldChestVisibleUntil);
  const dismissGoldChest = useGameStore((s) => s.dismissGoldChest);
  const [visible, setVisible] = useState(false);
  const [lidOpen, setLidOpen] = useState(false);
  const soundPlayedRef = useRef(false);

  const bursts = useMemo<BurstCoin[]>(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      tx: (Math.sin(i * 1.7) + (Math.random() - 0.5) * 0.4) * 200,
      ty: -40 - Math.random() * 200,
      rot: (Math.random() - 0.5) * 540,
      delay: 0.42 + i * 0.028,
      scale: 0.55 + Math.random() * 0.55,
    }));
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (until <= now) {
      setVisible(false);
      setLidOpen(false);
      soundPlayedRef.current = false;
      return;
    }
    setVisible(true);
    setLidOpen(false);
    const openT = window.setTimeout(() => setLidOpen(true), 520);
    if (!soundPlayedRef.current) {
      soundPlayedRef.current = true;
      playMilestoneFanfare();
    }
    const left = until - now;
    const tmr = window.setTimeout(() => {
      setVisible(false);
      setLidOpen(false);
      dismissGoldChest();
      soundPlayedRef.current = false;
    }, left);
    return () => {
      clearTimeout(openT);
      clearTimeout(tmr);
    };
  }, [until, dismissGoldChest]);

  const close = () => {
    setVisible(false);
    setLidOpen(false);
    dismissGoldChest();
    soundPlayedRef.current = false;
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="milestone-a1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/82 px-5 backdrop-blur-md"
          role="dialog"
          aria-modal
          aria-labelledby="milestone-a1-title"
          onClick={close}
        >
          <div
            className="pointer-events-none relative flex max-w-md flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="absolute -z-10 h-72 w-72 rounded-full opacity-90 blur-3xl"
              aria-hidden
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.45, 0.75, 0.5],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(124,58,237,0.48), rgba(167,139,250,0.22) 40%, transparent 70%)',
              }}
            />

            <div
              className="relative h-36 w-44 [transform-style:preserve-3d]"
              style={{ perspective: 560 }}
            >
              {bursts.map((c) => (
                <motion.span
                  key={c.id}
                  className="pointer-events-none absolute left-1/2 top-[42%] z-20 -translate-x-1/2 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                  aria-hidden
                  initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0 }}
                  animate={
                    lidOpen
                      ? {
                          opacity: [0, 1, 1, 0.85],
                          x: c.tx,
                          y: c.ty,
                          rotate: c.rot,
                          scale: [0, c.scale, c.scale * 1.05, c.scale],
                        }
                      : {}
                  }
                  transition={{
                    delay: c.delay,
                    duration: 1.15,
                    ease: [0.22, 0.85, 0.32, 1],
                  }}
                >
                  🪙
                </motion.span>
              ))}

              <motion.div
                className="absolute bottom-0 left-1/2 z-10 h-[52%] w-[88%] -translate-x-1/2 rounded-b-2xl border-2 border-amber-700/80 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 shadow-[inset_0_2px_12px_rgba(255,255,255,0.12),0_16px_40px_rgba(0,0,0,0.55)]"
                initial={{ scale: 0.86, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              >
                <div className="absolute inset-x-3 top-2 h-1 rounded-full bg-amber-950/40" aria-hidden />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl opacity-40" aria-hidden>
                  ✦
                </div>
              </motion.div>

              <motion.div
                className="absolute left-1/2 top-[6%] z-[11] h-[48%] w-[88%] origin-bottom -translate-x-1/2 rounded-t-2xl border-2 border-b-0 border-violet-600/90 bg-gradient-to-b from-violet-300 via-violet-500 to-violet-800 shadow-[0_-4px_24px_rgba(124,58,237,0.35)] [transform-style:preserve-3d]"
                initial={{ rotateX: 0, y: 0 }}
                animate={{
                  rotateX: lidOpen ? -118 : 0,
                  y: lidOpen ? -6 : 0,
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
              >
                <div className="absolute left-1/2 top-2 h-3 w-10 -translate-x-1/2 rounded-full bg-amber-900/35" aria-hidden />
              </motion.div>

              <motion.div
                className="absolute left-1/2 top-[58%] z-[12] -translate-x-1/2 text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                animate={lidOpen ? { scale: [1, 1.2, 1], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.55, delay: lidOpen ? 0.15 : 0 }}
                aria-hidden
              >
                🔒
              </motion.div>
            </div>

            <motion.h2
              id="milestone-a1-title"
              className="mt-6 font-display text-[clamp(1.15rem,4.5vw,1.65rem)] font-extrabold leading-tight tracking-tight text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #c4b5fd 0%, #7C3AED 38%, #a78bfa 72%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 14px rgba(124,58,237,0.4))',
              }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {t('rewards.a1_milestone_headline')}
            </motion.h2>
            <motion.p
              className="mt-2 max-w-sm px-2 text-sm leading-relaxed text-[rgba(255,248,220,0.88)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              {t('rewards.a1_chest_body')}
            </motion.p>
            <motion.p
              className="mt-4 font-mono text-3xl font-black tabular-nums tracking-tight text-[#F59E0B] drop-shadow-[0_0_20px_rgba(245,158,11,0.45)]"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 260, damping: 16 }}
            >
              {t('common.plus_amount_artik', { amount: 1000 })}
            </motion.p>
            <motion.p
              className="mt-5 text-[11px] font-medium text-artikl-caption"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              {t('rewards.milestone_tap_to_close')}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
