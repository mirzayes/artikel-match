import { formatLocalDate } from './dateKeys';

/** Yerli vaxt: 09:00 və 21:00 saatlarında öyrənmə / bonus sikkələri ikiqat. */
export function getGoldenHourCoinMultiplier(now = new Date()): number {
  const h = now.getHours();
  return h === 9 || h === 21 ? 2 : 1;
}

/** Odlu seriyası 3 gündən çox: öyrənmə sessiyası Artikində +10%. */
export function getOdluStreakArtikMultiplier(odluStreakDays: number): number {
  return odluStreakDays > 3 ? 1.1 : 1;
}

export function getLessonCoinMultiplier(now: Date, odluStreakDays: number): number {
  return getGoldenHourCoinMultiplier(now) * getOdluStreakArtikMultiplier(odluStreakDays);
}

export function isGoldenHourLocal(now = new Date()): boolean {
  return getGoldenHourCoinMultiplier(now) > 1;
}

export function coinsWithTurboMultiplier(raw: number, now = new Date()): number {
  return Math.max(0, Math.floor(raw * getGoldenHourCoinMultiplier(now)));
}

/** Happy Hours: eyni məntiq — mükafatı 2-yə vurmaq üçün. */
export const applyHappyHourCoinBonus = coinsWithTurboMultiplier;

const GOLDEN_NOTIFY_SESSION = 'artikel-golden-hour-notify';

/** Brauzer bildirişi (icazə verilibsə), gündə bir dəfə hər «qızıl saat» pəncərəsi üçün. */
export function tryNotifyGoldenHourStart(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!isGoldenHourLocal()) return;
  if (Notification.permission !== 'granted') return;
  const hour = new Date().getHours();
  const day = formatLocalDate(new Date());
  const key = `${GOLDEN_NOTIFY_SESSION}-${day}-${hour}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    new Notification('Artikel Match', {
      body:
        'Qızıl saat başladı! İndi öyrən və 2 qat çox Artik qazan!',
      tag: key,
    });
  } catch {
    /* ignore */
  }
}
