import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLeaderboard } from '../lib/leaderboard';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  totalXpAllLevels: number;
  displayName: string;
  onSaveDisplayName: (name: string) => void;
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

export function LeaderboardModal({
  open,
  onClose,
  totalXpAllLevels,
  displayName,
  onSaveDisplayName,
}: LeaderboardModalProps) {
  const userRowRef = useRef<HTMLTableRowElement>(null);
  const [draftName, setDraftName] = useState(displayName);

  const snap = useMemo(
    () => buildLeaderboard(totalXpAllLevels, displayName),
    [totalXpAllLevels, displayName],
  );

  useEffect(() => {
    if (open) setDraftName(displayName);
  }, [open, displayName]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      userRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(t);
  }, [open, snap.userRank]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="lb-overlay"
          role="presentation"
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Bağla"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-title"
            className="relative z-[81] flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/12 bg-[#0c0c14] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:border-white/10"
            initial={{ y: 48, opacity: 0.96 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <div>
                <h2 id="leaderboard-title" className="gamify-block-title !text-[11px] !opacity-80">
                  Liderlər · XP
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/12 px-3 py-1.5 text-sm font-semibold text-[rgba(232,232,245,0.65)] transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                Bağla
              </button>
            </div>

            <div className="shrink-0 space-y-2 border-b border-white/[0.06] bg-white/[0.03] px-5 py-3 sm:px-6">
              <p className="text-center text-sm text-white">
                <span className="text-[rgba(232,232,245,0.5)]">Sənin yerin:</span>{' '}
                <span className="font-display text-lg font-bold tabular-nums text-[var(--artikl-accent2)]">
                  {snap.userRank}
                </span>
                <span className="text-[rgba(232,232,245,0.35)]"> / </span>
                <span className="tabular-nums text-[rgba(232,232,245,0.55)]">{snap.totalPlayers}</span>
              </p>
              {snap.nextAbove ? (
                <p className="text-center text-xs leading-relaxed text-[rgba(232,232,245,0.48)]">
                  Növbəti hədəf:{' '}
                  <span className="font-semibold text-[rgba(232,232,245,0.78)]">{snap.nextAbove.name}</span>
                  <span className="tabular-nums"> ({snap.nextAbove.xp} XP)</span>
                  {snap.xpToOvertake != null ? (
                    <>
                      {' '}
                      — keçmək üçün təxminən{' '}
                      <span className="font-semibold text-amber-300/90">{snap.xpToOvertake}</span> XP çox topla
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-center text-xs text-emerald-400/85">Sən birincisən! 👑</p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-[rgba(232,232,245,0.38)]">
                    <th className="w-12 px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Oyunçu</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.rows.map((row) => {
                    const medal = rankMedal(row.rank);
                    const top3 = row.rank <= 3;
                    return (
                      <tr
                        key={row.id}
                        ref={row.isUser ? userRowRef : undefined}
                        className={[
                          'border-t border-white/[0.06]',
                          row.isUser
                            ? 'bg-[rgba(108,99,255,0.12)] ring-1 ring-[rgba(108,99,255,0.35)]'
                            : top3
                              ? 'bg-white/[0.04]'
                              : '',
                        ].join(' ')}
                      >
                        <td className="px-2 py-2.5 align-middle tabular-nums text-[rgba(232,232,245,0.55)]">
                          <span className="inline-flex min-w-[2rem] items-center gap-1">
                            {medal ? (
                              <span className="text-lg leading-none" aria-hidden>
                                {medal}
                              </span>
                            ) : (
                              <span>{row.rank}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 align-middle font-medium text-white">
                          {row.name}
                          {row.isUser ? (
                            <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--artikl-accent2)]">
                              sən
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right align-middle tabular-nums text-[rgba(232,232,245,0.72)]">
                          {row.xp.toLocaleString('az-AZ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-6">
              <label htmlFor="lb-display-name" className="text-xs font-medium text-[rgba(232,232,245,0.45)]">
                Cədvəldə görünən ad (isteğe bağlı)
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="lb-display-name"
                  type="text"
                  maxLength={24}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Məs. Aysu"
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(232,232,245,0.25)] outline-none ring-0 focus:border-[var(--artikl-accent)]/50"
                />
                <button
                  type="button"
                  onClick={() => onSaveDisplayName(draftName.trim())}
                  className="shrink-0 rounded-xl border border-transparent bg-[var(--artikl-accent)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Saxla
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
