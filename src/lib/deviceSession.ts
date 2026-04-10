import { onValue, ref, set } from 'firebase/database';
import { isFirebaseLive, isRealtimeDatabaseUrlConfigured, rtdb } from './firebase';

const LOCAL_DEVICE_ID_KEY = 'artikel-device-session-id';

/** Brauzerdə sabit təsadüfi cihaz ID (localStorage). */
export function getOrCreateLocalDeviceId(): string {
  try {
    let id = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
    if (!id || id.length < 8) {
      id = `d_${crypto.randomUUID()}`;
      localStorage.setItem(LOCAL_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `d_fallback_${Math.random().toString(36).slice(2, 14)}`;
  }
}

/**
 * Sessiya kilidi: cari cihaz «qalır» — `lastDeviceId` həmişə bu brauzerin ID-si olur.
 * Başqa cihaz daxil olanda o da öz ID-sini yazır; köhnə cihaz real-time dinləyicidə fərqi görüb çıxır.
 */
export async function claimDeviceSessionLock(duelUid: string): Promise<void> {
  if (!rtdb || !isFirebaseLive || !isRealtimeDatabaseUrlConfigured()) return;
  const id = duelUid.trim();
  if (!id) return;
  const local = getOrCreateLocalDeviceId();
  try {
    await set(ref(rtdb, `users/${id}/lastDeviceId`), local);
  } catch {
    /* şəbəkə / icazə */
  }
}

/**
 * RTDB-də `lastDeviceId` bu cihazın ID-si deyilsə — başqa yerdə eyni hesab açılıb.
 */
export function subscribeDeviceSessionLock(
  duelUid: string,
  localDeviceId: string,
  onLostLock: () => void,
): () => void {
  if (!rtdb || !isFirebaseLive || !isRealtimeDatabaseUrlConfigured()) return () => {};
  const id = duelUid.trim();
  if (!id) return () => {};
  const pathRef = ref(rtdb, `users/${id}/lastDeviceId`);
  let lostOnce = false;
  return onValue(pathRef, (snap) => {
    const v = snap.exists() ? String(snap.val()) : '';
    if (v.length === 0) return;
    if (v !== localDeviceId && !lostOnce) {
      lostOnce = true;
      onLostLock();
    }
  });
}
