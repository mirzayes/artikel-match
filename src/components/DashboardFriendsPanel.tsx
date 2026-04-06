import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { onValue, ref } from 'firebase/database';
import { isFirebaseLive, rtdb } from '../lib/firebase';
import { getOrCreateDuelUserId } from './DuelGame';
import type { PublicActivity } from '../lib/userPresenceRtdb';

type FriendStatus = {
  state: 'online' | 'offline' | string;
  activity: PublicActivity | string;
};

function statusLabel(s: FriendStatus | undefined, t: TFunction): string {
  if (!s) return t('friends.status_loading');
  if (s.state === 'offline') return t('friends.status_offline');
  if (s.activity === 'in_game') return t('friends.status_in_game');
  if (s.state === 'online') return t('friends.status_online');
  return t('friends.status_unknown');
}

function statusColor(s: FriendStatus | undefined): string {
  if (!s || s.state === 'offline') return 'text-[var(--artikl-muted)]';
  if (s.activity === 'in_game') return 'text-violet-300/90';
  return 'text-emerald-300/90';
}

export function DashboardFriendsPanel() {
  const { t } = useTranslation();
  const userId = getOrCreateDuelUserId();
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [byId, setById] = useState<Record<string, FriendStatus | undefined>>({});

  useEffect(() => {
    if (!isFirebaseLive || !rtdb) {
      setFriendIds([]);
      return;
    }
    const friendsRef = ref(rtdb, `users/${userId}/friends`);
    const unsub = onValue(friendsRef, (snap) => {
      const v = snap.val() as Record<string, true> | null;
      setFriendIds(v ? Object.keys(v).filter((k) => v[k]) : []);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!isFirebaseLive || !rtdb || friendIds.length === 0) return;
    const unsubs: Array<() => void> = [];
    for (const fid of friendIds) {
      const pr = ref(rtdb, `users/${fid}/publicStatus`);
      const u = onValue(pr, (snap) => {
        const raw = snap.val() as FriendStatus | null;
        setById((prev) => ({
          ...prev,
          [fid]: raw ?? { state: 'offline', activity: 'menu' },
        }));
      });
      unsubs.push(u);
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [friendIds]);

  if (friendIds.length === 0) {
    return (
      <div className="mx-auto mt-5 w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 backdrop-blur-[14px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.35)]">
          {t('friends.title')}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--artikl-muted)]">
          {t('friends.empty_hint')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-5 w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 backdrop-blur-[14px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(232,232,245,0.35)]">
        {t('friends.title_status')}
      </p>
      <ul className="mt-3 space-y-2">
        {friendIds.map((fid) => {
          const st = byId[fid];
          return (
            <li
              key={fid}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
            >
              <span className="min-w-0 truncate font-mono text-[11px] text-white/85" title={fid}>
                {fid.length > 18 ? `${fid.slice(0, 18)}…` : fid}
              </span>
              <span className={`shrink-0 text-[10px] font-semibold ${statusColor(st)}`}>
                {statusLabel(st, t)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
