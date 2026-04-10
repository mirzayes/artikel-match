import { get, onValue, ref, set } from 'firebase/database';
import { isFirebaseLive, requireRtdb } from './firebase';

export type PrivateRivalryEntry = {
  wins: number;
  losses: number;
  /** Ardıcıl qələbələr (eyni rəqibə qarşı) */
  winStreak: number;
  oppDisplayName?: string;
};

function rivalryRefPath(myUid: string, opponentUid: string): string {
  return `users/${myUid}/privateDuelRivalry/${opponentUid}`;
}

/**
 * Xüsusi (otaq linki) duel bitəndə: W/L və win streak yenilənir.
 * Random matchmaking üçün çağırılmır.
 */
export async function recordPrivateDuelRivalryResult(args: {
  myUid: string;
  opponentUid: string;
  won: boolean;
  oppDisplayName: string;
}): Promise<PrivateRivalryEntry | null> {
  if (!isFirebaseLive) return null;
  try {
    const db = requireRtdb();
    const r = ref(db, rivalryRefPath(args.myUid, args.opponentUid));
    const snap = await get(r);
    const raw = snap.val() as Partial<PrivateRivalryEntry> | null;
    const prev: PrivateRivalryEntry = {
      wins: typeof raw?.wins === 'number' && raw.wins >= 0 ? raw.wins : 0,
      losses: typeof raw?.losses === 'number' && raw.losses >= 0 ? raw.losses : 0,
      winStreak: typeof raw?.winStreak === 'number' && raw.winStreak >= 0 ? raw.winStreak : 0,
    };
    const next: PrivateRivalryEntry = {
      ...prev,
      oppDisplayName: args.oppDisplayName.trim().slice(0, 48) || prev.oppDisplayName,
    };
    if (args.won) {
      next.wins = prev.wins + 1;
      next.winStreak = prev.winStreak + 1;
    } else {
      next.losses = prev.losses + 1;
      next.winStreak = 0;
    }
    await set(r, next);
    return next;
  } catch {
    return null;
  }
}

export type RivalryListRow = { opponentUid: string } & PrivateRivalryEntry;

export function subscribePrivateDuelRivalryList(
  myUid: string,
  cb: (rows: RivalryListRow[]) => void,
): () => void {
  if (!isFirebaseLive) {
    cb([]);
    return () => {};
  }
  try {
    const db = requireRtdb();
    const r = ref(db, `users/${myUid}/privateDuelRivalry`);
    return onValue(r, (snap) => {
      const v = snap.val() as Record<string, Partial<PrivateRivalryEntry>> | null;
      if (!v) {
        cb([]);
        return;
      }
      const rows: RivalryListRow[] = Object.entries(v).map(([opponentUid, e]) => ({
        opponentUid,
        wins: typeof e.wins === 'number' && e.wins >= 0 ? e.wins : 0,
        losses: typeof e.losses === 'number' && e.losses >= 0 ? e.losses : 0,
        winStreak: typeof e.winStreak === 'number' && e.winStreak >= 0 ? e.winStreak : 0,
        oppDisplayName: typeof e.oppDisplayName === 'string' ? e.oppDisplayName : undefined,
      }));
      rows.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
      cb(rows);
    });
  } catch {
    cb([]);
    return () => {};
  }
}
