/**
 * Yerli «push» (brauzer bildirişi): SW `showNotification` + əsas səhifə klik.
 * Qeyd: brauzer tətbiqi bağlı olanda dəqiq 10:00/20:00 işə salın bilməz — istifadəçi
 * tətbiqi açanda və ya açıq pəncərədə hər dəqiqə yoxlanılır (PWA server push yoxdur).
 */
import { formatLocalDate } from './dateKeys';
import { computeOdluSeriya } from './odluStreak';
import { ODLU_DAILY_GOAL, ODLU_DAILY_GOAL_OPTIONS, type OdluDailyGoalOption } from '../types';

/** `useQuizProgress` ilə eyni açar — dəyişəndə sinxron saxlayın. */
const QUIZ_PROGRESS_STORAGE_KEY = 'german-articles-progress-v2';

const PERMISSION_ASKED_KEY = 'artikl-pwa-notif-permission-asked-v1';
const MORNING_DONE_KEY = 'artikl-pwa-notif-morning-ymd';
const EVENING_DONE_KEY = 'artikl-pwa-notif-evening-ymd';

const PLAYER_STORE_KEY = 'artikel-player-store-v1';

const MORNING_MINUTES = 10 * 60;
const EVENING_MINUTES = 20 * 60;

const MORNING_TITLE = 'Artikel Match';
const MORNING_BODY = 'Sabahınız xeyir! Almaniya səni gözləyir. 5 dəqiqə vaxt ayır 🇩🇪';

const EVENING_TITLE = 'Artikel Match';
const EVENING_BODY = "Sənin 'Streak' alovun sönmək üzrədir! 🔥 Tez daxil ol!";

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function normalizeDailyCorrectMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
    if (n > 0) out[k] = n;
  }
  return out;
}

function readOdluDailyGoal(raw: unknown): OdluDailyGoalOption {
  if (typeof raw === 'number' && (ODLU_DAILY_GOAL_OPTIONS as readonly number[]).includes(raw)) {
    return raw as OdluDailyGoalOption;
  }
  return ODLU_DAILY_GOAL;
}

function readStreakFreezeCoversToday(todayKey: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PLAYER_STORE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const s = (parsed?.state ?? parsed) as Record<string, unknown>;
    const isFrozen = Boolean(s?.isStreakFrozen);
    const ymd = typeof s?.streakFreezeProtectedYmd === 'string' ? s.streakFreezeProtectedYmd : '';
    return isFrozen && ymd !== '' && ymd === todayKey;
  } catch {
    return false;
  }
}

function readOdluSnapshot(todayKey: string) {
  if (typeof localStorage === 'undefined') {
    return computeOdluSeriya({}, todayKey, ODLU_DAILY_GOAL, false);
  }
  try {
    const raw = localStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY);
    if (!raw) return computeOdluSeriya({}, todayKey, ODLU_DAILY_GOAL, false);
    const p = JSON.parse(raw) as Record<string, unknown>;
    const map = normalizeDailyCorrectMap(p.dailyCorrectCountByDate);
    const goal = readOdluDailyGoal(p.odluDailyGoal);
    const freeze = readStreakFreezeCoversToday(todayKey);
    return computeOdluSeriya(map, todayKey, goal, freeze);
  } catch {
    return computeOdluSeriya({}, todayKey, ODLU_DAILY_GOAL, false);
  }
}

function readLs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

async function postShowLocalNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active || reg.waiting || reg.installing;
    if (!worker) return false;
    worker.postMessage({
      type: 'SHOW_LOCAL_NOTIF',
      title,
      body,
      tag,
      icon: `${typeof location !== 'undefined' ? location.origin : ''}/pwa-192x192.png`,
      url: `${typeof location !== 'undefined' ? location.origin : ''}/`,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Brauzerdə ilk açılışda bildiriş icazəsi (bir dəfə soruşulur).
 * Qeyd: bəzi brauzerlər istifadəçi jesti tələb edə bilər — PWA HTTPS-də adətən işləyir.
 */
export function promptNotificationPermissionOnFirstLaunch(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (readLs(PERMISSION_ASKED_KEY) === '1') return;
    writeLs(PERMISSION_ASKED_KEY, '1');
    void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

/**
 * Gündəlik 10:00 və 20:00 üçün yerli bildirişlər (SW `showNotification`).
 * Axşam: yalnız `atRisk` olduqda (gün norması tutulmayıb, seriya var, dondurucu yox) — spam yoxdur.
 */
export function tickPwaScheduledLocalNotifications(): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const todayKey = formatLocalDate(now);
  const mins = minutesSinceMidnight(now);

  if (mins >= MORNING_MINUTES && readLs(MORNING_DONE_KEY) !== todayKey) {
    void postShowLocalNotification(MORNING_TITLE, MORNING_BODY, `artikl-morning-${todayKey}`).then((ok) => {
      if (ok) writeLs(MORNING_DONE_KEY, todayKey);
    });
  }

  if (mins >= EVENING_MINUTES && readLs(EVENING_DONE_KEY) !== todayKey) {
    const odlu = readOdluSnapshot(todayKey);
    if (!odlu.atRisk) {
      writeLs(EVENING_DONE_KEY, todayKey);
      return;
    }
    void postShowLocalNotification(EVENING_TITLE, EVENING_BODY, `artikl-evening-${todayKey}`).then((ok) => {
      if (ok) writeLs(EVENING_DONE_KEY, todayKey);
    });
  }
}

export function startPwaLocalNotificationScheduler(): () => void {
  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      tickPwaScheduledLocalNotifications();
    }
  };

  tick();

  const id = window.setInterval(tick, 60_000);
  const onVis = () => tick();
  document.addEventListener('visibilitychange', onVis);

  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVis);
  };
}
