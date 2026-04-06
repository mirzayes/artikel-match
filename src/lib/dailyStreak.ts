/**
 * Gündəlik seriya: localStorage, təqvim günləri (lokal vaxt zonası).
 * Əlavə paket yoxdur.
 */

export const DAILY_STREAK_STORAGE_KEY = 'artikel-daily-streak-v1';

type Stored = { lastYmd: string; streak: number };

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, mo, da] = ymd.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + deltaDays);
  return localYmd(dt);
}

function parseStored(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object') return null;
    const rec = j as Record<string, unknown>;
    const lastYmd = typeof rec.lastYmd === 'string' ? rec.lastYmd : '';
    const streak = typeof rec.streak === 'number' ? rec.streak : Number(rec.streak);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastYmd) || !Number.isFinite(streak)) return null;
    return { lastYmd, streak: Math.max(0, Math.floor(streak)) };
  } catch {
    return null;
  }
}

/**
 * Bu sessiyada son ziyarəti yeniləyir və cari ardıcıl gün sayını qaytarır.
 * - İlk ziyarət: 1
 * - Eyni təqvim günü: dəyişmir
 * - Dərhal növbəti gün: +1
 * - ≥1 gün buraxılıbsa: 1-ə sıfırlanır
 */
export function syncDailyStreak(): number {
  if (typeof localStorage === 'undefined') return 0;

  const today = localYmd(new Date());
  let prev: Stored | null;
  try {
    prev = parseStored(localStorage.getItem(DAILY_STREAK_STORAGE_KEY));
  } catch {
    prev = null;
  }

  if (!prev) {
    const next: Stored = { lastYmd: today, streak: 1 };
    try {
      localStorage.setItem(DAILY_STREAK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return 1;
  }

  if (prev.lastYmd === today) {
    return Math.max(1, prev.streak);
  }

  const yesterday = addCalendarDaysYmd(today, -1);
  let next: Stored;
  if (prev.lastYmd === yesterday) {
    next = { lastYmd: today, streak: prev.streak + 1 };
  } else {
    next = { lastYmd: today, streak: 1 };
  }

  try {
    localStorage.setItem(DAILY_STREAK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next.streak;
}
