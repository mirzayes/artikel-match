import { increment, onValue, ref, set, update } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

/** Готовые «смешные» аватарки — id хранится в `users/{uid}/profile/avatar` */
export const PLAYER_AVATARS = [
  { id: 'pretzel', emoji: '🥨', label: 'Pretzel' },
  { id: 'beer', emoji: '🍺', label: 'Beer' },
  { id: 'castle', emoji: '🏰', label: 'Castle' },
  { id: 'racecar', emoji: '🏎️', label: 'Race car' },
  { id: 'dachshund', emoji: '🐕', label: 'Dachshund' },
  { id: 'croissant', emoji: '🥐', label: 'Croissant' },
] as const;

export type PlayerAvatarId = (typeof PLAYER_AVATARS)[number]['id'];

export function avatarIdToEmoji(id: string | null | undefined): string {
  const row = PLAYER_AVATARS.find((a) => a.id === id);
  return row?.emoji ?? '🎮';
}

export async function setPlayerAvatar(userId: string, avatarId: string): Promise<void> {
  const allowed = PLAYER_AVATARS.some((a) => a.id === avatarId);
  if (!allowed || !userId.trim() || !rtdb || !isFirebaseLive) return;
  try {
    await set(ref(rtdb, `users/${userId}/profile/avatar`), avatarId);
  } catch {
    /* no user-facing errors */
  }
}

export async function setPlayerProfileDisplayName(userId: string, name: string): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  const trimmed = name.trim().slice(0, 32);
  const label = trimmed || 'Oyunçu';
  try {
    await update(ref(rtdb, `users/${userId}/profile`), {
      displayName: label,
      name: label,
    });
  } catch {
    /* no user-facing errors */
  }
}

/**
 * Admin: RTDB `users/{uid}/isAlpha` = true (Firebase Console, Admin SDK və ya bu funksiya ilə).
 * Client yazısı üçün qaydalarda icazə olmalıdır.
 */
export async function markAsAlphaTester(uid: string): Promise<void> {
  const id = uid.trim();
  if (!id || !rtdb || !isFirebaseLive) return;
  try {
    await set(ref(rtdb, `users/${id}/isAlpha`), true);
  } catch {
    /* Admin / qaydalar */
  }
}

export function subscribeIsAlphaTester(userId: string, cb: (isAlpha: boolean) => void): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb(false);
    return () => {};
  }
  const id = userId.trim();
  if (!id) {
    cb(false);
    return () => {};
  }
  return onValue(ref(rtdb, `users/${id}/isAlpha`), (snap) => {
    cb(snap.val() === true);
  });
}

export type PublicPlayerProfile = {
  avatar?: string;
  displayName?: string;
};

export function subscribeUserProfile(
  userId: string,
  cb: (data: PublicPlayerProfile | null) => void,
): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb(null);
    return () => {};
  }
  return onValue(ref(rtdb, `users/${userId}/profile`), (snap) => {
    const v = snap.val() as { avatar?: unknown; displayName?: unknown } | null;
    if (!v) {
      cb(null);
      return;
    }
    cb({
      avatar: typeof v.avatar === 'string' ? v.avatar : undefined,
      displayName: typeof v.displayName === 'string' ? v.displayName : undefined,
    });
  });
}

export type DuelStatsRtdb = { total: number; wins: number };

export function subscribeDuelStats(userId: string, cb: (data: DuelStatsRtdb) => void): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb({ total: 0, wins: 0 });
    return () => {};
  }
  return onValue(ref(rtdb, `users/${userId}/duelStats`), (snap) => {
    const v = snap.val() as { total?: unknown; wins?: unknown } | null;
    const total = typeof v?.total === 'number' && !Number.isNaN(v.total) ? v.total : 0;
    const wins = typeof v?.wins === 'number' && !Number.isNaN(v.wins) ? v.wins : 0;
    cb({ total, wins });
  });
}

/** Один заход в онлайн-дуэль (фиксируется при выходе из комнаты). */
export async function recordOnlineDuelFinished(userId: string, won: boolean): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  try {
    await update(ref(rtdb, `users/${userId}/duelStats`), {
      total: increment(1),
      wins: increment(won ? 1 : 0),
    });
  } catch {
    /* no user-facing errors */
  }
}
