import { onValue, ref, set, query, orderByChild, limitToLast } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatar: string;
  totalXp: number;
}

/**
 * Writes the user's current XP to `leaderboard/{uid}`.
 * Called whenever totalXp changes.
 */
export async function syncLeaderboardXp(
  userId: string,
  totalXp: number,
  displayName: string,
  avatar: string,
): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  try {
    await set(ref(rtdb, `leaderboard/${userId}`), {
      displayName: displayName.trim().slice(0, 32) || 'Oyunçu',
      avatar: avatar || 'pretzel',
      totalXp: Math.max(0, Math.floor(totalXp)),
    });
  } catch {
    /* silent */
  }
}

/**
 * Subscribes to the top N leaderboard entries (by totalXp descending).
 * Returns an unsubscribe function.
 */
export function subscribeLeaderboard(
  limit: number,
  cb: (entries: LeaderboardEntry[]) => void,
): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb([]);
    return () => {};
  }

  const q = query(ref(rtdb, 'leaderboard'), orderByChild('totalXp'), limitToLast(limit));

  return onValue(q, (snap) => {
    const entries: LeaderboardEntry[] = [];
    snap.forEach((child) => {
      const val = child.val() as Record<string, unknown> | null;
      if (!val) return;
      entries.push({
        uid: child.key!,
        displayName: typeof val.displayName === 'string' ? val.displayName : 'Oyunçu',
        avatar: typeof val.avatar === 'string' ? val.avatar : 'pretzel',
        totalXp: typeof val.totalXp === 'number' ? val.totalXp : 0,
      });
    });
    entries.sort((a, b) => b.totalXp - a.totalXp);
    cb(entries);
  });
}
