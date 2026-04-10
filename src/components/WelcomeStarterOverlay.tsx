import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

type WelcomeStarterOverlayProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function WelcomeStarterOverlay({ visible, onDismiss }: WelcomeStarterOverlayProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="welcome-starter"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[205] flex items-center justify-center bg-black/88 px-6 backdrop-blur-md"
          role="dialog"
          aria-modal
          aria-labelledby="welcome-starter-title"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="pointer-events-none max-w-md text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 -z-10 blur-3xl" aria-hidden>
              <div className="mx-auto h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/35 via-violet-500/25 to-amber-400/30" />
            </div>
            <p id="welcome-starter-title" className="font-display text-xl font-extrabold leading-snug text-artikl-text sm:text-2xl">
              {t('onboarding.welcome_starter_message')}
            </p>
            <p className="mt-6 text-[11px] font-medium text-artikl-caption">
              {t('onboarding.welcome_starter_tap')}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
