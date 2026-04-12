import { formatLocalDate, previousLocalDateKey } from './dateKeys';

/** Retention: son aktiv gün (YYYY-MM-DD, lokal təqvim). */
export const RETENTION_LAST_ACTIVITY_KEY = 'last_activity_date';
/** Retention: ardıcıl aktiv günlərin sayı (mətn rəqəm). */
export const RETENTION_CURRENT_STREAK_KEY = 'current_streak';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function readLs(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function parseStreak(raw: string | null): number {
  if (raw == null || raw === '') return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Retention seriyası: tətbiq açılanda.
 * - Dünən aktiv olubsa: `current_streak` +1
 * - Bu gün artıq hesablanıbsa: dəyişiklik yoxdur
 * - Aralıq (və ya ilk girişdən sonra kəsinti): `current_streak` = 0, sonra bu gün üçün baza
 * - İlk açılış: seriya 1, `last_activity_date` = bu gün
 */
export type CheckStreakResult = {
  streak: number;
  lastActivityDate: string;
  /** Bu açılışda seriya artdı (ilk gün və ya dünənki fasiləsiz davam). */
  didBumpStreak: boolean;
};

export function checkStreak(): CheckStreakResult {
  if (typeof localStorage === 'undefined') {
    const today = formatLocalDate(new Date());
    return { streak: 0, lastActivityDate: today, didBumpStreak: false };
  }

  const today = formatLocalDate(new Date());
  const yesterday = previousLocalDateKey(today);
  const lastRaw = readLs(RETENTION_LAST_ACTIVITY_KEY);
  const last = lastRaw && YMD_RE.test(lastRaw) ? lastRaw : null;

  if (!last) {
    writeLs(RETENTION_LAST_ACTIVITY_KEY, today);
    writeLs(RETENTION_CURRENT_STREAK_KEY, '1');
    return { streak: 1, lastActivityDate: today, didBumpStreak: true };
  }

  if (last === today) {
    const streak = parseStreak(readLs(RETENTION_CURRENT_STREAK_KEY));
    return { streak: Math.max(0, streak), lastActivityDate: last, didBumpStreak: false };
  }

  if (last === yesterday) {
    const prev = parseStreak(readLs(RETENTION_CURRENT_STREAK_KEY));
    const next = Math.max(1, prev + 1);
    writeLs(RETENTION_LAST_ACTIVITY_KEY, today);
    writeLs(RETENTION_CURRENT_STREAK_KEY, String(next));
    return { streak: next, lastActivityDate: today, didBumpStreak: true };
  }

  writeLs(RETENTION_LAST_ACTIVITY_KEY, today);
  writeLs(RETENTION_CURRENT_STREAK_KEY, '0');
  return { streak: 0, lastActivityDate: today, didBumpStreak: false };
}

/** UI / analitika üçün cari dəyərlər (checkStreak çağırmadan). */
export function readRetentionStreakState(): { streak: number; lastActivityDate: string | null } {
  if (typeof localStorage === 'undefined') return { streak: 0, lastActivityDate: null };
  const last = readLs(RETENTION_LAST_ACTIVITY_KEY);
  const streak = parseStreak(readLs(RETENTION_CURRENT_STREAK_KEY));
  return {
    streak,
    lastActivityDate: last && YMD_RE.test(last) ? last : null,
  };
}
