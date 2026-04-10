/** Bu sessiyada cihaz uyğunsuzluğu — yenidən anonim giriş etmə. */
export const DEVICE_SESSION_KICK_KEY = 'artikel-device-session-kick';

export function isDeviceSessionKicked(): boolean {
  try {
    return sessionStorage.getItem(DEVICE_SESSION_KICK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDeviceSessionKicked(): void {
  try {
    sessionStorage.setItem(DEVICE_SESSION_KICK_KEY, '1');
  } catch {
    /* ignore */
  }
}
