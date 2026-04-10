import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AmbientOrbs } from './layout/AmbientOrbs';
import { PLAYER_AVATARS, avatarIdToEmoji } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';

type PlayerRegistrationScreenProps = {
  onComplete: () => void;
};

export function PlayerRegistrationScreen({ onComplete }: PlayerRegistrationScreenProps) {
  const { t } = useTranslation();
  const storeName = useGameStore((s) => s.playerName);
  const avatar = useGameStore((s) => s.avatar);
  const setAvatar = useGameStore((s) => s.setAvatar);
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [draftName, setDraftName] = useState(() => storeName);
  const heroEmoji = avatarIdToEmoji(avatar);

  const handleOk = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setPlayer(trimmed, avatar);
    onComplete();
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <AmbientOrbs />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        className="relative z-[1] w-full max-w-[420px] overflow-hidden rounded-[22px] border border-white/[0.12] shadow-[0_16px_48px_rgba(124,60,255,0.22)]"
        style={{
          background:
            'linear-gradient(135deg, rgba(99,63,200,0.35) 0%, rgba(12,12,20,0.92) 45%, rgba(167,139,250,0.14) 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[#7c6cf8]/25 blur-[48px]"
          aria-hidden
        />
        <div className="relative px-5 py-6 sm:px-6 sm:py-7">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8d4ff]/85">
            {t('registration.welcome')}
          </p>
          <h1 className="mt-2 text-center font-display text-xl font-bold text-artikl-text sm:text-2xl">
            {t('registration.title')}
          </h1>
          <p className="mt-2 text-center text-[11px] text-artikl-muted2">
            {t('registration.subtitle')}
          </p>

          <div className="mt-6 flex justify-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260, delay: 0.12 }}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/[0.04] text-[2.6rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              aria-hidden
            >
              {heroEmoji}
            </motion.div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption">
              {t('profile.pick_avatar')}
            </p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              {PLAYER_AVATARS.map((a, i) => {
                const on = avatar === a.id;
                const avatarLabel = t(`profile.avatar_${a.id}` as 'profile.avatar_pretzel');
                return (
                  <motion.button
                    key={a.id}
                    type="button"
                    title={avatarLabel}
                    aria-pressed={on}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.03, duration: 0.25 }}
                    onClick={() => setAvatar(a.id)}
                    className={[
                      'flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all duration-200 active:scale-[0.94]',
                      on
                        ? 'scale-105 ring-2 ring-[#c4b5fd] ring-offset-2 ring-offset-[#14141f] border border-white/20 bg-white/[0.14] shadow-[0_0_22px_rgba(167,139,250,0.4)]'
                        : 'border border-white/10 bg-white/[0.06] hover:border-[#a89ff8]/50 hover:bg-white/[0.1]',
                    ].join(' ')}
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span className="sr-only">{avatarLabel}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <label
              htmlFor="reg-display-name"
              className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption"
            >
              {t('registration.player_name_label')}
            </label>
            <input
              id="reg-display-name"
              type="text"
              maxLength={32}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t('profile.name_placeholder')}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-3 text-sm text-artikl-text placeholder:text-artikl-caption outline-none focus:border-[#a89ff8]/55"
            />
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleOk}
            disabled={!draftName.trim()}
            className="mt-6 w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3.5 text-sm font-bold text-white shadow-[0_6px_24px_rgba(124,108,248,0.35)] transition-opacity disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-200 disabled:text-[#9CA3AF] dark:border-transparent dark:bg-gradient-to-r dark:from-[#7c6cf8] dark:to-[#c44fd9] dark:disabled:opacity-40"
          >
            {t('profile.ok')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
