import { onValue, ref, update, query, orderByChild, limitToLast } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatar: string;
  totalXp: number;
}

type ProfileSnap = {
  xp?: unknown;
  name?: unknown;
  displayName?: unknown;
  avatar?: unknown;
};

function profileDisplayName(p: ProfileSnap | null | undefined): string {
  if (!p) return 'Oyunçu';
  if (typeof p.name === 'string' && p.name.trim()) return p.name.trim().slice(0, 32);
  if (typeof p.displayName === 'string' && p.displayName.trim()) return p.displayName.trim().slice(0, 32);
  return 'Oyunçu';
}

/**
 * Syncs XP + public leaderboard fields to `users/{uid}/profile`:
 * `xp`, `name`, `avatar` (RTDB query: orderByChild('profile/xp')).
 */
export async function syncLeaderboardXp(
  userId: string,
  totalXp: number,
  displayName: string,
  avatar: string,
): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  const trimmedName = displayName.trim().slice(0, 32) || 'Oyunçu';
  const xp = Math.max(0, Math.floor(totalXp));
  const av = avatar || 'pretzel';
  try {
    await update(ref(rtdb, `users/${userId}/profile`), {
      xp,
      name: trimmedName,
      avatar: av,
    });
  } catch {
    /* silent */
  }
}

/**
 * Real-time top N users by `users/{uid}/profile/xp` (descending).
 */
export function subscribeLeaderboard(limit: number, cb: (entries: LeaderboardEntry[]) => void): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb([]);
    return () => {};
  }

  const q = query(ref(rtdb, 'users'), orderByChild('profile/xp'), limitToLast(limit));

  return onValue(q, (snap) => {
    const entries: LeaderboardEntry[] = [];
    snap.forEach((child) => {
      const uid = child.key;
      if (!uid) return;
      const val = child.val() as { profile?: ProfileSnap } | null;
      const p = val?.profile;
      const xpRaw = p?.xp;
      const xp = typeof xpRaw === 'number' && !Number.isNaN(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : null;
      if (xp === null) return;

      entries.push({
        uid,
        displayName: profileDisplayName(p),
        avatar: typeof p?.avatar === 'string' ? p.avatar : 'pretzel',
        totalXp: xp,
      });
    });
    entries.sort((a, b) => b.totalXp - a.totalXp);
    cb(entries);
  });
}
