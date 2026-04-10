import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

type PioneerBonusOverlayProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function PioneerBonusOverlay({ visible, onDismiss }: PioneerBonusOverlayProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="pioneer-bonus"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[208] flex items-center justify-center bg-black/88 px-6 backdrop-blur-md"
          role="dialog"
          aria-modal
          aria-labelledby="pioneer-bonus-title"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.88, y: 28 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 14 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="pointer-events-none relative max-w-md text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl" aria-hidden>
              <div className="mx-auto h-64 w-64 rounded-full bg-gradient-to-br from-[#7C3AED]/40 via-violet-500/35 to-fuchsia-500/25" />
            </div>
            <p className="text-5xl drop-shadow-[0_4px_24px_rgba(124,58,237,0.35)]" aria-hidden>
              👑
            </p>
            <p
              id="pioneer-bonus-title"
              className="mt-4 font-display text-[clamp(1.15rem,4.8vw,1.65rem)] font-extrabold leading-snug tracking-tight text-transparent sm:text-2xl"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #c4b5fd 0%, #7C3AED 32%, #a78bfa 62%, #e9d5ff 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 18px rgba(124,58,237,0.35))',
              }}
            >
              {t('onboarding.pioneer_bonus_message')}
            </p>
            <p className="mt-8 text-[11px] font-medium text-artikl-caption">
              {t('onboarding.pioneer_bonus_tap')}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
