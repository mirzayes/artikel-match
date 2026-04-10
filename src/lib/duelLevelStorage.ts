import { GOETHE_LEVELS, type GoetheLevel } from '../types';

const STORAGE_KEY = 'artikel-duel-goethe-level';

function isGoetheLevel(v: string): v is GoetheLevel {
  return (GOETHE_LEVELS as readonly string[]).includes(v);
}

/** Son seçilmiş duel leksika səviyyəsi; yoxdursa `fallback`. */
export function readStoredDuelLevel(fallback: GoetheLevel): GoetheLevel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isGoetheLevel(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function persistDuelLevel(level: GoetheLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* ignore */
  }
}
