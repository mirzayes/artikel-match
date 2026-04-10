import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrCreateDuelUserId } from './DuelGame';
import {
  PLAYER_AVATARS,
  avatarIdToEmoji,
  setPlayerAvatar,
  subscribeDuelStats,
  subscribeIsAlphaTester,
  subscribeUserProfile,
} from '../lib/playerProfileRtdb';
import { isFirebaseLive } from '../lib/firebase';
import { publishReferralCodeMapping, REFERRAL_REWARD_COINS } from '../lib/referralRtdb';
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
  const storeCoins = useGameStore((s) => s.coins);
  const [draftName, setDraftName] = useState(playerName);
  const [duelStats, setDuelStats] = useState({ total: 0, wins: 0 });
  const [isAlphaTester, setIsAlphaTester] = useState(false);
  const [dailyStreak] = useState(() => (typeof window !== 'undefined' ? syncDailyStreak() : 0));
  const referralCodeDisplay = useGameStore((s) => s.referralCode);
  const [referralToast, setReferralToast] = useState<string | null>(null);

  /** Profil yüklənəndə kod yaradılır (ad + rəqəmlər) və ekranda göstərilir. */
  useLayoutEffect(() => {
    useGameStore.getState().getOrCreateReferralCode();
  }, []);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  /** Kod mövcud olanda RTDB: `referralCodes/{kod}` → uid. */
  useEffect(() => {
    const code = useGameStore.getState().getOrCreateReferralCode();
    if (!code || code.length < 6) return;
    if (!isFirebaseLive) return;
    void publishReferralCodeMapping(code, userId);
  }, [userId, referralCodeDisplay, isFirebaseLive]);

  useEffect(() => {
    if (!referralToast) return;
    const t = window.setTimeout(() => setReferralToast(null), 2400);
    return () => clearTimeout(t);
  }, [referralToast]);

  useEffect(() => {
    const unsubP = subscribeUserProfile(userId, (p) => {
      const id = typeof p?.avatar === 'string' ? p.avatar : null;
      if (id && PLAYER_AVATARS.some((a) => a.id === id)) setAvatar(id);
    });
    const unsubS = subscribeDuelStats(userId, setDuelStats);
    const unsubA = subscribeIsAlphaTester(userId, setIsAlphaTester);
    return () => {
      unsubP();
      unsubS();
      unsubA();
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
              <h2 className="font-display inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-lg font-bold leading-tight text-artikl-text sm:text-xl">
                <span>{playerName.trim() ? playerName.trim() : t('profile.name_empty_hint')}</span>
                {isAlphaTester ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#7C3AED] dark:text-amber-100"
                    title="Pioner"
                    aria-label="Pioner"
                  >
                    <span aria-hidden>👑</span>
                    Pioner
                  </span>
                ) : null}
              </h2>
              {dailyStreak > 0 ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full border border-orange-400/40 bg-gradient-to-r from-orange-500/25 to-amber-500/15 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-[#7C3AED] shadow-[0_0_12px_rgba(251,146,60,0.25)] dark:text-orange-100"
                  title={t('profile.daily_streak_aria', { count: dailyStreak })}
                  aria-label={t('profile.daily_streak_aria', { count: dailyStreak })}
                >
                  <span aria-hidden>🔥</span>
                  {dailyStreak}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-artikl-muted2">
              {t('profile.subtitle')}
            </p>
            {!isFirebaseLive ? (
              <p className="mt-1 text-[10px] text-artikl-caption">
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
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-artikl-text">
              {totalShown}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-400/28 bg-[rgba(139,92,246,0.1)] px-3 py-3 backdrop-blur-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#1A1A2E] dark:text-violet-200/85">
              {t('profile.wins')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-artikl-text">
              {winPct}
              <span className="text-base font-semibold text-[#1A1A2E] dark:text-violet-200/90">{t('profile.percent_unit')}</span>
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-artikl-caption">
              {t('profile.stats_ratio', { wins: winsShown, total: totalShown })}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-amber-400/28 bg-amber-500/[0.08] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#4B5563] dark:text-amber-200/80">
            {t('profile.balance_title')}
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#7C3AED] dark:text-amber-100">
            {t('common.balance_display', { amount: storeCoins })}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption">
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

        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5563] dark:text-amber-200/85">
            {t('profile.referral_title')}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-artikl-muted2">
            {t('profile.referral_hint', { coins: REFERRAL_REWARD_COINS })}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[11px] text-[#1A1A2E] dark:text-amber-100/90">
              {referralCodeDisplay || '…'}
            </code>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              animate={{
                scale: [1, 1.045, 1],
                boxShadow: [
                  '0 8px 28px rgba(124,58,237,0.38)',
                  '0 12px 36px rgba(124,58,237,0.52)',
                  '0 8px 28px rgba(124,58,237,0.38)',
                ],
              }}
              transition={{
                duration: 2.1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              onClick={async () => {
                const code = useGameStore.getState().getOrCreateReferralCode();
                const link = `${window.location.origin}${window.location.pathname}?ref=${code}`;
                try {
                  await navigator.clipboard.writeText(link);
                } catch {
                  const ta = document.createElement('textarea');
                  ta.value = link;
                  ta.style.cssText = 'position:fixed;opacity:0';
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  document.body.removeChild(ta);
                }
                setReferralToast(t('profile.referral_copied'));
              }}
              className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 via-[#7C3AED] to-violet-800 px-3.5 py-2.5 text-[11px] font-extrabold text-violet-50 ring-2 ring-violet-400/50 ring-offset-2 ring-offset-[#14141f]"
            >
              {t('profile.referral_invite_btn', { coins: REFERRAL_REWARD_COINS })}
            </motion.button>
          </div>
          {referralToast ? (
            <p className="mt-2 text-center text-[11px] font-medium text-emerald-300/95">{referralToast}</p>
          ) : null}
        </div>

        <div className="mt-4">
          <label
            htmlFor="profile-display-name"
            className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption"
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
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-artikl-text placeholder:text-artikl-caption outline-none focus:border-[#a89ff8]/55"
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
              className="shrink-0 rounded-xl border-2 border-purple-600 bg-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_24px_rgba(124,108,248,0.35)] dark:border-transparent dark:bg-gradient-to-r dark:from-[#7c6cf8] dark:to-[#c44fd9]"
            >
              {t('profile.ok')}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
