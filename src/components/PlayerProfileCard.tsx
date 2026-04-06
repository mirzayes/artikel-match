import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrCreateDuelUserId } from './DuelGame';
import {
  PLAYER_AVATARS,
  avatarIdToEmoji,
  setPlayerAvatar,
  subscribeDuelStats,
  subscribeUserProfile,
} from '../lib/playerProfileRtdb';
import { isFirebaseLive } from '../lib/firebase';
import { useGameStore } from '../store/useGameStore';
import { syncDailyStreak } from '../lib/dailyStreak';

type PlayerProfileCardProps = {
  onSaveDisplayName: (name: string) => void;
  /** After a successful confirm (store + quiz name saved), e.g. navigate to learn mode with animation. */
  onEnterGame?: () => void;
};

export function PlayerProfileCard({ onSaveDisplayName, onEnterGame }: PlayerProfileCardProps) {
  const { t } = useTranslation();
  const userId = getOrCreateDuelUserId();
  const playerName = useGameStore((s) => s.playerName);
  const avatar = useGameStore((s) => s.avatar);
  const setAvatar = useGameStore((s) => s.setAvatar);
  const storeWins = useGameStore((s) => s.wins);
  const storeTotalDuels = useGameStore((s) => s.totalDuels);
  const storeScore = useGameStore((s) => s.score);
  const [draftName, setDraftName] = useState(playerName);
  const [duelStats, setDuelStats] = useState({ total: 0, wins: 0 });
  const [dailyStreak] = useState(() => (typeof window !== 'undefined' ? syncDailyStreak() : 0));

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  useEffect(() => {
    const unsubP = subscribeUserProfile(userId, (p) => {
      const id = typeof p?.avatar === 'string' ? p.avatar : null;
      if (id && PLAYER_AVATARS.some((a) => a.id === id)) setAvatar(id);
    });
    const unsubS = subscribeDuelStats(userId, setDuelStats);
    return () => {
      unsubP();
      unsubS();
    };
  }, [userId, setAvatar]);

  const totalShown = isFirebaseLive ? duelStats.total : storeTotalDuels;
  const winsShown = isFirebaseLive ? duelStats.wins : storeWins;
  const winPct = totalShown > 0 ? Math.round((winsShown / totalShown) * 100) : 0;
  const heroEmoji = avatarIdToEmoji(avatar);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.015 }}
      className="relative mx-auto mt-5 w-full max-w-[420px] overflow-hidden rounded-[22px] border border-white/[0.12] shadow-[0_16px_48px_rgba(124,60,255,0.22)]"
      style={{
        background:
          'linear-gradient(135deg, rgba(99,63,200,0.35) 0%, rgba(12,12,20,0.92) 45%, rgba(167,139,250,0.12) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[#7c6cf8]/25 blur-[48px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[#a78bfa]/20 blur-[40px]"
        aria-hidden
      />

      <div className="relative px-4 py-5 sm:px-5">
        <div className="flex items-start gap-4">
          <div
            className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/[0.04] text-[2.6rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            aria-hidden
          >
            {heroEmoji}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8d4ff]/85">
              {t('profile.my_profile')}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold leading-tight text-white sm:text-xl">
                {playerName.trim() ? playerName.trim() : t('profile.name_empty_hint')}
              </h2>
              {dailyStreak > 0 ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full border border-orange-400/40 bg-gradient-to-r from-orange-500/25 to-amber-500/15 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-orange-100 shadow-[0_0_12px_rgba(251,146,60,0.25)]"
                  title={t('profile.daily_streak_aria', { count: dailyStreak })}
                  aria-label={t('profile.daily_streak_aria', { count: dailyStreak })}
                >
                  <span aria-hidden>🔥</span>
                  {dailyStreak}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-[rgba(232,232,245,0.5)]">
              {t('profile.subtitle')}
            </p>
            {!isFirebaseLive ? (
              <p className="mt-1 text-[10px] text-[rgba(232,232,245,0.38)]">
                {t('profile.offline_points', { score: storeScore })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-400/25 bg-[rgba(16,185,129,0.1)] px-3 py-3 backdrop-blur-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-200/75">
              {t('profile.duels_played')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
              {totalShown}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-400/28 bg-[rgba(139,92,246,0.1)] px-3 py-3 backdrop-blur-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-200/85">
              {t('profile.wins')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
              {winPct}
              <span className="text-base font-semibold text-violet-200/90">{t('profile.percent_unit')}</span>
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-[rgba(232,232,245,0.45)]">
              {t('profile.stats_ratio', { wins: winsShown, total: totalShown })}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.45)]">
            {t('profile.pick_avatar')}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PLAYER_AVATARS.map((a) => {
              const on = avatar === a.id;
              const avatarLabel = t(`profile.avatar_${a.id}` as 'profile.avatar_pretzel');
              return (
                <button
                  key={a.id}
                  type="button"
                  title={avatarLabel}
                  aria-pressed={on}
                  onClick={() => {
                    setAvatar(a.id);
                    if (isFirebaseLive) void setPlayerAvatar(userId, a.id);
                  }}
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all duration-200 active:scale-[0.94]',
                    on
                      ? 'scale-105 ring-2 ring-[#c4b5fd] ring-offset-2 ring-offset-[#14141f] border border-white/20 bg-white/[0.14] shadow-[0_0_24px_rgba(167,139,250,0.45)]'
                      : 'border border-white/10 bg-white/[0.06] opacity-90 hover:border-[#a89ff8]/50 hover:bg-white/[0.1] hover:opacity-100',
                  ].join(' ')}
                >
                  <span aria-hidden>{a.emoji}</span>
                  <span className="sr-only">{avatarLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="profile-display-name"
            className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.45)]"
          >
            {t('profile.duel_name_label')}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="profile-display-name"
              type="text"
              maxLength={32}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t('profile.name_placeholder')}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-[rgba(232,232,245,0.25)] outline-none focus:border-[#a89ff8]/55"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              onClick={() => {
                const name = draftName.trim();
                if (!name) return;
                const av = useGameStore.getState().avatar;
                useGameStore.getState().setPlayer(name, av);
                onSaveDisplayName(name);
                if (isFirebaseLive) void setPlayerAvatar(userId, av);
                window.setTimeout(() => onEnterGame?.(), 160);
              }}
              className="shrink-0 rounded-xl bg-gradient-to-r from-[#7c6cf8] to-[#c44fd9] px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_24px_rgba(124,108,248,0.35)]"
            >
              {t('profile.ok')}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
