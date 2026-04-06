import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { get, onChildAdded, ref } from 'firebase/database';
import { isFirebaseLive, rtdb } from '../lib/firebase';
import { acceptFriendRequest, declineFriendRequest } from '../lib/friendsRtdb';

interface FriendsNotificationLayerProps {
  userId: string;
}

/**
 * Всплывающее уведомление о новом запросе в друзья (слушает `users/{userId}/incomingFriendRequests`).
 */
export function FriendsNotificationLayer({ userId }: FriendsNotificationLayerProps) {
  const { t } = useTranslation();
  const [fromId, setFromId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || !isFirebaseLive || !rtdb) return;
    const r = ref(rtdb, `users/${userId}/incomingFriendRequests`);
    let cancelled = false;
    let unsub: (() => void) | null = null;

    void (async () => {
      const initial = await get(r);
      if (cancelled) return;
      const baseline = new Set(Object.keys(initial.val() || {}));

      unsub = onChildAdded(r, (snap) => {
        const key = snap.key;
        if (!key || baseline.has(key)) return;
        baseline.add(key);
        setFromId(key);
      });
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [userId]);

  const short = (id: string) => (id.length > 14 ? `${id.slice(0, 14)}…` : id);

  return (
    <AnimatePresence>
      {fromId ? (
        <motion.div
          key={fromId}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[120] w-[min(100%,380px)] -translate-x-1/2 px-4"
        >
          <div className="rounded-2xl border border-white/12 bg-[#12121a]/96 p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">{t('friends.request_title')}</p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--artikl-muted2)]">
              <Trans
                i18nKey="friends.invite_message"
                values={{ id: short(fromId) }}
                components={{
                  highlight: (
                    <span
                      className="font-mono text-[11px] text-[var(--artikl-accent2)]"
                      title={fromId}
                    />
                  ),
                }}
              />
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void acceptFriendRequest(userId, fromId)
                    .then(() => setFromId(null))
                    .finally(() => setBusy(false));
                }}
                className="flex-1 rounded-xl bg-[#7c6cf8] py-2.5 text-xs font-bold text-white shadow-[0_6px_24px_rgba(124,108,248,0.3)] active:scale-[0.98] disabled:opacity-50"
              >
                {t('friends.accept')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void declineFriendRequest(userId, fromId)
                    .then(() => setFromId(null))
                    .finally(() => setBusy(false));
                }}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-[rgba(232,232,245,0.8)] active:scale-[0.98] disabled:opacity-50"
              >
                {t('friends.decline')}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
