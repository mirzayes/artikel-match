import { onDisconnect, ref, set, serverTimestamp } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

export type PublicActivity = 'menu' | 'in_game';

/**
 * Поддерживает `users/{userId}/publicStatus`: state/state online/offline + activity.
 * При закрытии вкладки — offline (через onDisconnect).
 */
export async function bindAppPresence(userId: string): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  const statusRef = ref(rtdb, `users/${userId}/publicStatus`);
  await set(statusRef, {
    state: 'online',
    activity: 'menu',
    updatedAt: serverTimestamp(),
  });
  await onDisconnect(statusRef).set({
    state: 'offline',
    activity: 'menu',
    updatedAt: serverTimestamp(),
  });
}

/** Вызовите из дуэли / других экранов. */
export function setUserActivity(userId: string, activity: PublicActivity): void {
  if (!userId.trim() || !rtdb || !isFirebaseLive) return;
  void set(ref(rtdb, `users/${userId}/publicStatus`), {
    state: 'online',
    activity,
    updatedAt: serverTimestamp(),
  });
}
