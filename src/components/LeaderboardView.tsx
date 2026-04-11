import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboardLiveQuery } from '../lib/leaderboardLiveQuery';
import { isFirebaseLive } from '../lib/firebase';
import { buildLeaderboard, LEADERBOARD_NPCS } from '../lib/leaderboard';
import { avatarIdToEmoji } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';
import {
  LEAGUE_GOLD_MIN_XP,
  LEAGUE_SILVER_PUSH_START_XP,
  leagueSeasonEndsAtLocal,
  leagueSeasonRemainingMs,
  leagueSilverToGoldFillPercent,
} from '../lib/leaderboardLeagueUi';

/* ── Leagues ───────────────────────────────────────────────────────── */

interface League {
  id: 'bronze' | 'silver' | 'gold';
  label: string;
  emoji: string;
  minXp: number;
  maxXp: number;
  color: string;
  bgGradient: string;
  borderColor: string;
}

const LEAGUES: League[] = [
  {
    id: 'bronze',
    label: 'Bürünc Liqası',
    emoji: '🥉',
    minXp: 0,
    maxXp: 999,
    color: 'text-[#4B5563] dark:text-orange-300',
    bgGradient: 'from-orange-900/30 to-orange-950/10',
    borderColor: 'border-orange-500/30',
  },
  {
    id: 'silver',
    label: 'Gümüş Liqası',
    emoji: '🥈',
    minXp: 1_000,
    maxXp: 9_999,
    color: 'text-slate-200',
    bgGradient: 'from-slate-600/20 to-slate-800/10',
    borderColor: 'border-slate-400/30',
  },
  {
    id: 'gold',
    label: 'Qızıl Liqası',
    emoji: '🏆',
    minXp: 10_000,
    maxXp: Infinity,
    color: 'text-[#F59E0B]',
    bgGradient: 'from-[#F59E0B]/14 to-orange-950/10',
    borderColor: 'border-[#F59E0B]/35',
  },
];

function getLeague(xp: number): League {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXp) return LEAGUES[i];
  }
  return LEAGUES[0];
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function formatSeasonRemainLabel(ms: number, t: (k: string, o?: Record<string, number>) => string): string {
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (ms <= 0) return t('leaderboard.season_ending_now');
  if (days > 0) return t('leaderboard.season_countdown_dh', { days, hours });
  if (hours > 0) return t('leaderboard.season_countdown_hm', { hours, minutes });
  return t('leaderboard.season_countdown_m', { minutes: Math.max(0, minutes) });
}

const LB_SKELETON_ROWS = 8;

/* ── Props ─────────────────────────────────────────────────────────── */

interface LeaderboardViewProps {
  totalXpAllLevels: number;
  displayName: string;
  userId: string;
  avatar: string;
}

/* ── Row type ──────────────────────────────────────────────────────── */

interface LeaderRow {
  rank: number;
  uid: string;
  name: string;
  avatar: string;
  xp: number;
  isUser: boolean;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function LeaderboardView({
  totalXpAllLevels,
  displayName,
  userId,
  avatar,
}: LeaderboardViewProps) {
  const { t } = useTranslation();
  const coins = useGameStore((s) => s.coins);
  const getOrCreateReferralCode = useGameStore((s) => s.getOrCreateReferralCode);
  const { data: leaderboardLiveState } = useLeaderboardLiveQuery();
  const firebaseEntries = leaderboardLiveState?.entries ?? [];
  const loading = isFirebaseLive && !leaderboardLiveState?.seeded;
  const [selectedLeague, setSelectedLeague] = useState<League['id']>(() => getLeague(totalXpAllLevels).id);
  const userRowRef = useRef<HTMLTableRowElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [, setSeasonTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSeasonTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const inviteShareText = useMemo(() => {
    const code = getOrCreateReferralCode();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
    const link = `${origin}${path}?ref=${encodeURIComponent(code)}`;
    return t('leaderboard.invite_share_template', { coins, link });
  }, [coins, getOrCreateReferralCode, t]);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteShareText);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2200);
    } catch {
      /* ignore */
    }
  }, [inviteShareText]);

  const userLeague = getLeague(totalXpAllLevels);

  const firebaseGlobalEmpty =
    isFirebaseLive && leaderboardLiveState?.seeded === true && firebaseEntries.length === 0;

  const allRows: LeaderRow[] = useMemo(() => {
    const userName = displayName.trim() || 'Sən';

    if (firebaseGlobalEmpty) {
      return [{ uid: userId, name: userName, avatar, xp: totalXpAllLevels, isUser: true, rank: 1 }];
    }

    if (isFirebaseLive && firebaseEntries.length > 0) {
      const hasUser = firebaseEntries.some((e) => e.uid === userId);
      const combined = hasUser
        ? firebaseEntries.map((e) => ({
            uid: e.uid,
            name: e.uid === userId ? userName : e.displayName,
            avatar: e.uid === userId ? avatar : e.avatar,
            xp: e.uid === userId ? Math.max(e.totalXp, totalXpAllLevels) : e.totalXp,
            isUser: e.uid === userId,
          }))
        : [
            ...firebaseEntries.map((e) => ({
              uid: e.uid,
              name: e.displayName,
              avatar: e.avatar,
              xp: e.totalXp,
              isUser: false,
            })),
            { uid: userId, name: userName, avatar, xp: totalXpAllLevels, isUser: true },
          ];

      combined.sort((a, b) => b.xp - a.xp || (a.isUser ? -1 : 1));
      return combined.map((r, i) => ({ ...r, rank: i + 1 }));
    }

    const snap = buildLeaderboard(totalXpAllLevels, displayName);
    return snap.rows.map((r) => ({
      rank: r.rank,
      uid: r.id,
      name: r.name,
      avatar: r.isUser ? avatar : (LEADERBOARD_NPCS.find((n) => n.id === r.id) ? 'pretzel' : 'pretzel'),
      xp: r.xp,
      isUser: r.isUser,
    }));
  }, [
    firebaseEntries,
    firebaseGlobalEmpty,
    totalXpAllLevels,
    displayName,
    userId,
    avatar,
    leaderboardLiveState?.seeded,
  ]);

  const leagueRows = useMemo(() => {
    return allRows.filter((r) => {
      const l = getLeague(r.xp);
      return l.id === selectedLeague;
    });
  }, [allRows, selectedLeague]);

  const leagueRanked = useMemo(() => {
    return leagueRows.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [leagueRows]);

  const top10 = leagueRanked.slice(0, 10);

  const userInLeague = leagueRanked.find((r) => r.isUser);
  const showUserSeparately = userInLeague && userInLeague.rank > 10;

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      userRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(t);
  }, [selectedLeague]);

  const nextLeague = LEAGUES.find((l) => l.minXp > totalXpAllLevels);
  const xpToNextLeague = nextLeague ? nextLeague.minXp - totalXpAllLevels : null;

  const nowClock = new Date();
  const seasonEnd = leagueSeasonEndsAtLocal(nowClock);
  const seasonRemainMs = leagueSeasonRemainingMs(nowClock, seasonEnd);
  const seasonLabel = formatSeasonRemainLabel(seasonRemainMs, t);
  const silverPushPct = leagueSilverToGoldFillPercent(totalXpAllLevels);
  const showSilverPushBar = userLeague.id === 'silver';

  return (
    <div className="leaderboard-view-root flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-[var(--app-bottom-pad,7rem)] pt-[max(12px,env(safe-area-inset-top))] text-[var(--artikl-text)] sm:px-6 sm:pb-[var(--app-bottom-pad-sm,8rem)]">
      <div className="mx-auto w-full max-w-[420px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-lg font-bold text-artikl-heading">Liderlər</h1>
          <p className="mt-1 text-xs text-artikl-caption">
            Ən yaxşı oyunçularla yarış!
          </p>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="mt-4 w-full rounded-xl border-2 border-purple-600 bg-white py-3 text-[13px] font-bold text-purple-600 shadow-[0_6px_24px_rgba(124,58,237,0.12)] transition-colors hover:bg-purple-50 dark:border-violet-400/40 dark:bg-gradient-to-r dark:from-violet-600/25 dark:to-fuchsia-600/20 dark:text-violet-100 dark:shadow-[0_6px_24px_rgba(139,92,246,0.15)] hover:dark:border-violet-300/50"
          >
            {t('leaderboard.invite_friends')}
          </button>
        </motion.div>

        {/* User league badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className={`mt-5 rounded-2xl border bg-gradient-to-br p-4 text-center ${userLeague.borderColor} ${userLeague.bgGradient}`}
        >
          <span className="text-4xl">{userLeague.emoji}</span>
          <p className={`mt-1 text-sm font-bold ${userLeague.color}`}>{userLeague.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-artikl-heading">
            {totalXpAllLevels.toLocaleString('az-AZ')}{' '}
            <span className="text-sm font-semibold text-artikl-muted2">XP</span>
          </p>
          {xpToNextLeague != null && nextLeague ? (
            <p className="mt-1.5 text-[11px] text-artikl-muted2">
              {nextLeague.label} üçün{' '}
              <span className="font-bold text-[#F59E0B]/85">{xpToNextLeague.toLocaleString('az-AZ')}</span> XP lazımdır
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-emerald-400/80">Ən yüksək liqadasınız!</p>
          )}

          <p
            className="mt-3 rounded-xl border border-rose-400/25 bg-gradient-to-r from-rose-500/12 via-amber-500/10 to-orange-500/8 px-3 py-2 text-[11px] font-semibold leading-snug text-rose-100/90 shadow-[0_0_24px_rgba(251,113,133,0.12)]"
            role="status"
          >
            {seasonLabel}
          </p>
          <p className="mt-1 text-[10px] text-artikl-caption">{t('leaderboard.season_fomo_hint')}</p>

          {showSilverPushBar ? (
            <div className="mt-4 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300/85">
                {t('leaderboard.silver_push_title')}
              </p>
              <p className="mt-0.5 text-[10px] text-artikl-caption">
                {t('leaderboard.silver_push_range', {
                  from: LEAGUE_SILVER_PUSH_START_XP.toLocaleString('az-AZ'),
                  to: LEAGUE_GOLD_MIN_XP.toLocaleString('az-AZ'),
                })}
              </p>
              <div
                className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-900/90 shadow-[inset_0_1px_6px_rgba(0,0,0,0.45)] ring-1 ring-slate-400/50"
                role="progressbar"
                aria-valuemin={LEAGUE_SILVER_PUSH_START_XP}
                aria-valuemax={LEAGUE_GOLD_MIN_XP}
                aria-valuenow={Math.min(totalXpAllLevels, LEAGUE_GOLD_MIN_XP)}
                aria-label={t('leaderboard.silver_push_aria')}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-500 via-slate-200 to-slate-100 shadow-[0_0_18px_rgba(226,232,240,0.55),0_0_28px_rgba(148,163,184,0.45)] transition-[width] duration-700 ease-out"
                  style={{ width: `${silverPushPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] font-semibold tabular-nums text-slate-200/90">
                {totalXpAllLevels.toLocaleString('az-AZ')} / {LEAGUE_GOLD_MIN_XP.toLocaleString('az-AZ')} XP
              </p>
            </div>
          ) : null}
        </motion.div>

        {/* League tabs */}
        <div className="mt-5 flex gap-2">
          {LEAGUES.map((l) => {
            const active = l.id === selectedLeague;
            const count = allRows.filter((r) => getLeague(r.xp).id === l.id).length;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLeague(l.id)}
                className={[
                  'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 text-[11px] font-semibold transition-all',
                  active
                    ? `border ${l.borderColor} bg-gradient-to-b ${l.bgGradient} ${l.color}`
                    : 'border border-[var(--artikl-border)] bg-[var(--artikl-surface)] text-artikl-caption',
                ].join(' ')}
              >
                <span className="text-lg leading-none">{l.emoji}</span>
                <span className="mt-0.5 leading-tight">{l.id === 'bronze' ? 'Bürünc' : l.id === 'silver' ? 'Gümüş' : 'Qızıl'}</span>
                <span className="text-[9px] opacity-60">{count} oyunçu</span>
              </button>
            );
          })}
        </div>

        {/* Leaderboard table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] backdrop-blur-[14px] overflow-hidden"
        >
          {loading ? (
            <div className="px-1 py-3">
              <div className="flex items-center justify-between px-3 pb-2">
                <div
                  className="artikl-lb-skeleton-cell h-3 w-24"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="artikl-lb-skeleton-cell h-3 w-16"
                  style={{ animationDelay: '40ms' }}
                />
              </div>
              {Array.from({ length: LB_SKELETON_ROWS }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-t border-[var(--artikl-border)] px-3 py-3"
                >
                  <div
                    className="artikl-lb-skeleton-cell h-4 w-8 shrink-0"
                    style={{ animationDelay: `${i * 70}ms` }}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div
                      className="artikl-lb-skeleton-cell h-9 w-9 shrink-0 rounded-full"
                      style={{ animationDelay: `${i * 70 + 25}ms` }}
                    />
                    <div
                      className="artikl-lb-skeleton-cell h-3 max-w-[min(200px,55vw)] flex-1"
                      style={{ animationDelay: `${i * 70 + 50}ms` }}
                    />
                  </div>
                  <div
                    className="artikl-lb-skeleton-cell h-3 w-14 shrink-0"
                    style={{ animationDelay: `${i * 70 + 75}ms` }}
                  />
                </div>
              ))}
              <p className="pb-3 pt-1 text-center text-[11px] text-artikl-caption">
                {t('leaderboard.loading')}
              </p>
            </div>
          ) : firebaseGlobalEmpty ? (
            <div className="py-12 text-center">
              <span className="text-3xl">🏅</span>
              <p className="mt-2 text-sm text-artikl-caption">{t('leaderboard.empty_global')}</p>
            </div>
          ) : leagueRanked.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-3xl">🏅</span>
              <p className="mt-2 text-sm text-artikl-caption">Bu liqada hələ oyunçu yoxdur</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-artikl-caption">
                  <th className="w-14 px-3 py-2.5 font-medium">Sıra</th>
                  <th className="px-2 py-2.5 font-medium">İstifadəçi</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">Xal</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {top10.map((row, idx) => (
                    <LeaderRow
                      key={row.uid}
                      row={row}
                      idx={idx}
                      refProp={row.isUser ? userRowRef : undefined}
                    />
                  ))}

                  {showUserSeparately ? (
                    <>
                      <tr key="sep">
                        <td colSpan={3} className="px-3 py-1 text-center text-[10px] text-artikl-caption">
                          ···
                        </td>
                      </tr>
                      <LeaderRow
                        key={userInLeague.uid + '-below'}
                        row={userInLeague}
                        idx={userInLeague.rank - 1}
                        refProp={userRowRef}
                      />
                    </>
                  ) : null}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </motion.div>
      </div>

      {inviteOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 backdrop-blur-sm sm:items-center sm:pb-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-friends-title"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface)] p-5 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="invite-friends-title" className="text-base font-bold text-artikl-text">
              {t('leaderboard.invite_modal_title')}
            </h2>
            <p className="mt-1 text-[12px] text-artikl-muted2">{t('leaderboard.invite_hint')}</p>
            <textarea
              readOnly
              value={inviteShareText}
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface2)] px-3 py-2.5 text-[13px] leading-relaxed text-artikl-text"
            />
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98] dark:border-transparent dark:bg-gradient-to-r dark:from-violet-600 dark:to-fuchsia-600"
              >
                {inviteCopied ? t('leaderboard.invite_copied') : t('leaderboard.invite_copy')}
              </button>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="w-full rounded-xl border border-[var(--artikl-border2)] py-2.5 text-sm font-semibold text-artikl-muted2"
              >
                {t('leaderboard.invite_close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Row ───────────────────────────────────────────────────────────── */

function LeaderRow({
  row,
  idx,
  refProp,
}: {
  row: LeaderRow;
  idx: number;
  refProp?: React.Ref<HTMLTableRowElement>;
}) {
  const medal = rankMedal(row.rank);
  const top3 = row.rank <= 3;

  return (
    <motion.tr
      ref={refProp}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.25 }}
      className={[
        'border-t border-[var(--artikl-border)]',
        row.isUser
          ? 'bg-[rgba(108,99,255,0.14)] ring-1 ring-inset ring-[rgba(108,99,255,0.35)]'
          : top3
            ? 'bg-[var(--artikl-surface)]'
            : '',
      ].join(' ')}
    >
      <td className="px-3 py-2.5 align-middle tabular-nums text-artikl-muted2">
        {medal ? (
          <span className="text-lg leading-none">{medal}</span>
        ) : (
          <span className="text-xs">{row.rank}</span>
        )}
      </td>
      <td className="px-2 py-2.5 align-middle">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{avatarIdToEmoji(row.avatar)}</span>
          <span className="truncate font-medium text-artikl-text">{row.name}</span>
          {row.isUser ? (
            <span className="shrink-0 rounded-md bg-[var(--artikl-accent)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--artikl-accent2)]">
              sən
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right align-middle tabular-nums text-artikl-text">
        {row.xp.toLocaleString('az-AZ')}
      </td>
    </motion.tr>
  );
}
