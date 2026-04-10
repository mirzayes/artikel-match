import { onValue, ref } from 'firebase/database';
import { isFirebaseLive, rtdb } from './firebase';

/** `/matchmaking`-də status === waiting olan oyunçuların sayı (təxmini «boş rəqib» siqnalı). */
export function subscribeMatchmakingWaitingCount(cb: (count: number) => void): () => void {
  if (!rtdb || !isFirebaseLive) {
    cb(0);
    return () => {};
  }
  const r = ref(rtdb, 'matchmaking');
  return onValue(r, (snap) => {
    let n = 0;
    snap.forEach((child) => {
      const v = child.val() as { status?: string } | null;
      if (v?.status === 'waiting') n += 1;
    });
    cb(n);
  });
}
