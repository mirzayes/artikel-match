/**
 * Gündəlik giriş: localStorage-da ardıcıllıq və son giriş vaxtı.
 * Açar: artikel-daily-login-v1
 */
import { formatLocalDate, previousLocalDateKey } from './dateKeys';

export const DAILY_LOGIN_STORAGE_KEY = 'artikel-daily-login-v1';

export type DailyLoginRecord = {
  /** Ardıcıl təqvim günləri (giriş qeyd edilib) */
  streakCount: number;
  /** Son giriş Unix ms */
  lastLoginMs: number;
  /** Son giriş günü YYYY-MM-DD */
  lastLoginYmd: string;
};

function parse(raw: string | null): DailyLoginRecord | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object') return null;
    const o = j as Record<string, unknown>;
    const streakCount =
      typeof o.streakCount === 'number' && Number.isFinite(o.streakCount)
        ? Math.max(0, Math.floor(o.streakCount))
        : 0;
    const lastLoginMs =
      typeof o.lastLoginMs === 'number' && Number.isFinite(o.lastLoginMs)
        ? o.lastLoginMs
        : 0;
    const y = typeof o.lastLoginYmd === 'string' ? o.lastLoginYmd : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null;
    return { streakCount, lastLoginMs, lastLoginYmd: y };
  } catch {
    return null;
  }
}

function save(rec: DailyLoginRecord): void {
  try {
    localStorage.setItem(DAILY_LOGIN_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

/**
 * Hər app açılışında çağır: eyni gündə yalnız `lastLoginMs` yenilənir;
 * dünənki günə qədər ardıcıllıq varsa streak+1, yoxsa 1.
 */
export function syncDailyLoginStreak(now = new Date()): DailyLoginRecord {
  const today = formatLocalDate(now);
  const ms = now.getTime();
  let prev: DailyLoginRecord | null;
  try {
    prev = parse(localStorage.getItem(DAILY_LOGIN_STORAGE_KEY));
  } catch {
    prev = null;
  }

  if (!prev || !prev.lastLoginYmd) {
    const next: DailyLoginRecord = { streakCount: 1, lastLoginMs: ms, lastLoginYmd: today };
    save(next);
    return next;
  }

  if (prev.lastLoginYmd === today) {
    const next: DailyLoginRecord = { ...prev, lastLoginMs: ms };
    save(next);
    return next;
  }

  const yday = previousLocalDateKey(today);
  let streakCount: number;
  if (prev.lastLoginYmd === yday) {
    streakCount = Math.max(1, prev.streakCount + 1);
  } else {
    streakCount = 1;
  }

  const next: DailyLoginRecord = { streakCount, lastLoginMs: ms, lastLoginYmd: today };
  save(next);
  return next;
}
