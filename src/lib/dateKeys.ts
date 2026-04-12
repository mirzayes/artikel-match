/** Yerli təqvim üçün YYYY-MM-DD (gündəlik statistikalar). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localDateKey(): string {
  return formatLocalDate(new Date());
}

export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function previousLocalDateKey(key: string): string {
  const dt = parseLocalDateKey(key);
  dt.setDate(dt.getDate() - 1);
  return formatLocalDate(dt);
}

export function nextLocalDateKey(key: string): string {
  const dt = parseLocalDateKey(key);
  dt.setDate(dt.getDate() + 1);
  return formatLocalDate(dt);
}
