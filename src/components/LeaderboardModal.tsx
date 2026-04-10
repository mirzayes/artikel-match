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
            className="app-sheet-panel relative z-[81] flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/12 bg-[#0c0c14] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:border-[var(--artikl-border)]"
            initial={{ y: 48, opacity: 0.96 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--artikl-border)] px-5 py-4 sm:px-6">
              <div>
                <h2 id="leaderboard-title" className="gamify-block-title !text-[11px] !opacity-80">
                  Liderlər · XP
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/12 px-3 py-1.5 text-sm font-semibold text-artikl-text transition-colors hover:border-[var(--artikl-border2)] hover:bg-[var(--artikl-surface2)]"
              >
                Bağla
              </button>
            </div>

            <div className="shrink-0 space-y-2 border-b border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-5 py-3 sm:px-6">
              <p className="text-center text-sm text-artikl-text">
                <span className="text-artikl-muted2">Sənin yerin:</span>{' '}
                <span className="font-display text-lg font-bold tabular-nums text-[var(--artikl-accent2)]">
                  {snap.userRank}
                </span>
                <span className="text-artikl-caption"> / </span>
                <span className="tabular-nums text-artikl-muted2">{snap.totalPlayers}</span>
              </p>
              {snap.nextAbove ? (
                <p className="text-center text-xs leading-relaxed text-artikl-caption">
                  Növbəti hədəf:{' '}
                  <span className="font-semibold text-artikl-text">{snap.nextAbove.name}</span>
                  <span className="tabular-nums"> ({snap.nextAbove.xp} XP)</span>
                  {snap.xpToOvertake != null ? (
                    <>
                      {' '}
                      — keçmək üçün təxminən{' '}
                      <span className="font-semibold text-[#F59E0B]/90">{snap.xpToOvertake}</span> XP çox topla
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
                  <tr className="text-[11px] uppercase tracking-wider text-artikl-caption">
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
                          'border-t border-[var(--artikl-border)]',
                          row.isUser
                            ? 'bg-[rgba(108,99,255,0.12)] ring-1 ring-[rgba(108,99,255,0.35)]'
                            : top3
                              ? 'bg-[var(--artikl-surface)]'
                              : '',
                        ].join(' ')}
                      >
                        <td className="px-2 py-2.5 align-middle tabular-nums text-artikl-muted2">
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
                        <td className="px-2 py-2.5 align-middle font-medium text-artikl-text">
                          {row.name}
                          {row.isUser ? (
                            <span className="ml-2 rounded-md bg-[var(--artikl-surface2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--artikl-accent2)]">
                              sən
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right align-middle tabular-nums text-artikl-text">
                          {row.xp.toLocaleString('az-AZ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 border-t border-[var(--artikl-border)] px-5 py-4 sm:px-6">
              <label htmlFor="lb-display-name" className="text-xs font-medium text-artikl-caption">
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
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-[var(--artikl-surface2)] px-3 py-2.5 text-sm text-artikl-text placeholder:text-artikl-caption outline-none ring-0 focus:border-[var(--artikl-accent)]/50"
                />
                <button
                  type="button"
                  onClick={() => onSaveDisplayName(draftName.trim())}
                  className="shrink-0 rounded-xl border-2 border-purple-600 bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white dark:border-transparent dark:bg-[var(--artikl-accent)]"
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
