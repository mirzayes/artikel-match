/**
 * Referral: kod → RTDB, mükafat növbəsi «referralGrants/{uid}».
 * Qaydalar serverdə açıq olmalıdır; oflayn rejimdə sessiya yalnız lokal qalır.
 */
import { get, onChildAdded, push, ref, remove, set } from 'firebase/database';
import {
  ensureAnonymousFirebaseUser,
  isFirebaseConfigured,
  isFirebaseLive,
  isRealtimeDatabaseUrlConfigured,
  requireRtdb,
  rtdb,
} from './firebase';
import { useGameStore } from '../store/useGameStore';

/** RTDB kökü: `/referralCodes/{code}` (SDK: `ref(rtdb, \`referralCodes/${code}\`)`). */
const CODES = 'referralCodes';
const GRANTS = 'referralGrants';

export const REFERRAL_REWARD_COINS = 500;

/** Dəvət mükafatı yalnız bu XP-dən sonra (multi-account sui-istifadəsinə qarşı). */
export const REFERRAL_INVITEE_MIN_TOTAL_XP = 100;

function devWarn(msg: string, err?: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[referralRtdb] ${msg}`, err ?? '');
  }
}

/** Yazır: `/referralCodes/{kod}` → `{ uid, ts }` (`uid` — oyunçu RTDB id, adətən `u_…`). */
export async function publishReferralCodeMapping(code: string, ownerUid: string): Promise<void> {
  if (!isFirebaseConfigured || !isFirebaseLive || !rtdb) {
    devWarn('publish skipped: Firebase not fully configured (check all VITE_FIREBASE_* including DATABASE_URL)');
    return;
  }
  if (!isRealtimeDatabaseUrlConfigured()) {
    devWarn('publish skipped: VITE_FIREBASE_DATABASE_URL missing or placeholder');
    return;
  }
  const c = code.trim().toUpperCase();
  if (c.length < 6) return;
  const authed = await ensureAnonymousFirebaseUser();
  if (!authed) {
    devWarn('publish skipped: not signed in (anonymous auth failed or disabled in Console)');
    return;
  }
  const path = `${CODES}/${c}`;
  try {
    await set(ref(requireRtdb(), path), { uid: ownerUid, ts: Date.now() });
  } catch (e) {
    devWarn(`set() failed for /${path} — check database.rules.json (auth != null & write rules)`, e);
  }
}

export async function lookupReferralInviterUid(code: string): Promise<string | null> {
  if (!isFirebaseConfigured || !isFirebaseLive || !rtdb || !isRealtimeDatabaseUrlConfigured()) return null;
  const c = code.trim().toUpperCase();
  if (c.length < 6) return null;
  if (!(await ensureAnonymousFirebaseUser())) return null;
  try {
    const snap = await get(ref(requireRtdb(), `${CODES}/${c}`));
    if (!snap.exists()) return null;
    const v = snap.val() as { uid?: string } | null;
    const uid = typeof v?.uid === 'string' ? v.uid : '';
    return uid.length > 0 ? uid : null;
  } catch (e) {
    devWarn('lookupReferralInviterUid failed', e);
    return null;
  }
}

export async function enqueueReferralGrant(inviterUid: string, inviteeUid: string): Promise<void> {
  if (!isFirebaseConfigured || !isFirebaseLive || !rtdb || !isRealtimeDatabaseUrlConfigured()) return;
  if (!inviterUid || inviterUid === inviteeUid) return;
  if (!(await ensureAnonymousFirebaseUser())) return;
  try {
    await push(ref(requireRtdb(), `${GRANTS}/${inviterUid}`), {
      coins: REFERRAL_REWARD_COINS,
      inviteeUid,
      ts: Date.now(),
    });
  } catch (e) {
    devWarn(`enqueueReferralGrant failed for /${GRANTS}/${inviterUid}`, e);
  }
}

/** Dəvət edən: növbədəki mükafatları qəbul et (duel limitinə düşmür). */
export function subscribeReferralGrants(
  myUid: string,
  onGranted: (coins: number) => void,
): () => void {
  if (!rtdb || !isFirebaseLive || !isRealtimeDatabaseUrlConfigured() || !myUid) return () => {};
  const grantsRef = ref(rtdb, `${GRANTS}/${myUid}`);
  const unsub = onChildAdded(grantsRef, async (snapshot) => {
    const key = snapshot.key;
    const val = snapshot.val() as { coins?: number } | null;
    const coins = typeof val?.coins === 'number' && val.coins > 0 ? Math.floor(val.coins) : 0;
    if (key && coins > 0) {
      try {
        await remove(ref(requireRtdb(), `${GRANTS}/${myUid}/${key}`));
      } catch {
        /* ignore */
      }
      onGranted(coins);
    }
  });
  return unsub;
}

/**
 * Dəvət kodu varsa: etibarlı dəvət edən + dəvət olunan `totalXp > REFERRAL_INVITEE_MIN_TOTAL_XP` olduqda +500 növbəsi.
 * XP azdırsa `pendingReferralCode` saxlanılır — növbəti sessiyalarda yenidən yoxlanır.
 */
export async function tryProcessInviteeReferral(
  inviteeUid: string,
  referralCode: string | null,
  inviteeTotalXp: number,
): Promise<void> {
  try {
    if (!referralCode?.trim()) {
      useGameStore.setState({ referralInviteProcessed: true, pendingReferralCode: null });
      return;
    }
    const inviter = await lookupReferralInviterUid(referralCode);
    if (!inviter || inviter === inviteeUid) {
      useGameStore.setState({ referralInviteProcessed: true, pendingReferralCode: null });
      return;
    }
    const xp = Math.max(0, Math.floor(inviteeTotalXp));
    if (xp <= REFERRAL_INVITEE_MIN_TOTAL_XP) {
      return;
    }
    useGameStore.setState({ referralInviteProcessed: true, pendingReferralCode: null });
    await enqueueReferralGrant(inviter, inviteeUid);
  } catch {
    useGameStore.setState({ referralInviteProcessed: true, pendingReferralCode: null });
  }
}
