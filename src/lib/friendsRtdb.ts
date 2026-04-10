import { get, ref, set, update } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

/** Друзья: `users/{uid}/friends/{friendId}` = true */
/** Входящие: `users/{uid}/incomingFriendRequests/{fromId}` = { fromName, fromAvatar, timestamp } */

export async function sendFriendRequest(
  currentUserId: string,
  targetUserId: string,
  fromName: string,
  fromAvatar: string,
): Promise<void> {
  if (
    !currentUserId.trim() ||
    !targetUserId.trim() ||
    currentUserId === targetUserId ||
    !rtdb ||
    !isFirebaseLive
  )
    return;

  const [edgeMine, edgeTheirs] = await Promise.all([
    get(ref(rtdb, `users/${currentUserId}/friends/${targetUserId}`)),
    get(ref(rtdb, `users/${targetUserId}/friends/${currentUserId}`)),
  ]);
  if (edgeMine.exists() || edgeTheirs.exists()) return;

  await set(ref(rtdb, `users/${targetUserId}/incomingFriendRequests/${currentUserId}`), {
    fromName: fromName.trim() || 'Oyunçu',
    fromAvatar: fromAvatar.trim() || 'pretzel',
    timestamp: Date.now(),
  });
}

export async function acceptFriendRequest(currentUserId: string, fromUserId: string): Promise<void> {
  if (!currentUserId.trim() || !fromUserId.trim() || !rtdb || !isFirebaseLive) return;

  await update(ref(rtdb, `users/${currentUserId}`), {
    [`friends/${fromUserId}`]: true,
    [`incomingFriendRequests/${fromUserId}`]: null,
  });
  await update(ref(rtdb, `users/${fromUserId}`), {
    [`friends/${currentUserId}`]: true,
  });
}

export async function declineFriendRequest(currentUserId: string, fromUserId: string): Promise<void> {
  if (!currentUserId.trim() || !fromUserId.trim() || !rtdb || !isFirebaseLive) return;
  await update(ref(rtdb, `users/${currentUserId}`), {
    [`incomingFriendRequests/${fromUserId}`]: null,
  });
}
