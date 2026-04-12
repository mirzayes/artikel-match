import type { GoetheLevel, NounEntry } from '../types';
import { isLearnBlockMastered } from './learnBlocks';

/** Öyrənmə mövzusu: hər missiyada bu qədər isim (blokdan ayrı; sessiya ölçüsü 20 qalır). */
export const LEARNING_MISSION_WORD_COUNT = 25;

/** Missiya ilk dəfə tamamlandıqda (limitdən kənar). */
export const LEARNING_MISSION_ARTIK_REWARD = 50;

const MISSION_ORDER_STORAGE_PREFIX = 'mission_order_';
/** Klassik missiya sessiyası bitəndə (25 söz) — növbəti missiyanın kilidi üçün. */
const MISSION_SESSION_CLEARED_PREFIX = 'learning_mission_session_cleared_';

function missionOrderStorageKey(level: GoetheLevel): string {
  return `${MISSION_ORDER_STORAGE_PREFIX}${level}`;
}

export function missionSessionClearedStorageKey(level: GoetheLevel, missionIndex: number): string {
  return `${MISSION_SESSION_CLEARED_PREFIX}${level}_${missionIndex}`;
}

export function readMissionSessionCleared(level: GoetheLevel, missionIndex: number): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(missionSessionClearedStorageKey(level, missionIndex)) === '1';
  } catch {
    return false;
  }
}

/** Klassik missiya «Nəticə» ekranına çatanda çağırılır (SRS 5× deyil). */
export function markMissionSessionCleared(level: GoetheLevel, missionIndex: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = missionSessionClearedStorageKey(level, missionIndex);
    localStorage.setItem(key, '1');
    console.log('[missions] mission session COMPLETE — saved', { level, missionIndex, key });
    console.log('[missions] next mission gate may open for index', missionIndex + 1);
  } catch (e) {
    console.warn('[missions] failed to save session cleared', e);
  }
}

/** Təkmil sıfırlama: missiya sessiya kilidləri. */
export function clearAllMissionSessionClearedMarkers(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(MISSION_SESSION_CLEARED_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function isMissionWordsDoneForGate(
  missionNouns: NounEntry[],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  level: GoetheLevel,
  missionIndex: number,
): boolean {
  if (isLearnBlockMastered(missionNouns, knownWordIds, masteryByWordId)) return true;
  return readMissionSessionCleared(level, missionIndex);
}

function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Səviyyə üçün bütün sözləri bir dəfə qarışdırılmış ardıcıllıqla qaytarır (localStorage-da saxlanır).
 * Əvvəlcə tam siyahı qarışdırılır, sonra missiyalar 25-lik dilimlərə bölünür.
 */
export function getMissionOrderedNouns(level: GoetheLevel, nouns: NounEntry[]): NounEntry[] {
  if (nouns.length === 0) return [];
  const byId = new Map(nouns.map((n) => [n.id, n] as const));
  const currentIds = new Set(nouns.map((n) => n.id));

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(missionOrderStorageKey(level));
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const ordered: NounEntry[] = [];
          const used = new Set<string>();
          for (const id of parsed) {
            if (!currentIds.has(id)) continue;
            const n = byId.get(id);
            if (n) {
              ordered.push(n);
              used.add(id);
            }
          }
          for (const n of nouns) {
            if (!used.has(n.id)) ordered.push(n);
          }
          if (ordered.length === nouns.length) {
            return ordered;
          }
        }
      }
    } catch {
      /* yeni qarışdırma */
    }
  }

  const shuffled = shuffleIds(nouns.map((n) => n.id));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(missionOrderStorageKey(level), JSON.stringify(shuffled));
    } catch {
      /* kvota və s. */
    }
  }
  const out: NounEntry[] = [];
  for (const id of shuffled) {
    const n = byId.get(id);
    if (n) out.push(n);
  }
  return out;
}

export function chunkNounsIntoMissions(nouns: NounEntry[]): NounEntry[][] {
  if (nouns.length === 0) return [];
  const missions: NounEntry[][] = [];
  for (let i = 0; i < nouns.length; i += LEARNING_MISSION_WORD_COUNT) {
    missions.push(nouns.slice(i, i + LEARNING_MISSION_WORD_COUNT));
  }
  return missions;
}

export function formatMissionRange(missionIndex: number, missionNouns: NounEntry[]): string {
  const start = missionIndex * LEARNING_MISSION_WORD_COUNT + 1;
  const end = missionIndex * LEARNING_MISSION_WORD_COUNT + missionNouns.length;
  return `${start}–${end}`;
}

/** Missiya 0 həmişə; növbəti — əvvəlki mənimsənilib, sessiya bitib və ya ödənişlə hamısı açılıb. */
export function isMissionGateOpen(
  missionIndex: number,
  missions: NounEntry[][],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  allMissionsPaidUnlocked: boolean,
  level: GoetheLevel,
): boolean {
  if (allMissionsPaidUnlocked) return true;
  if (missionIndex <= 0) return true;
  const prev = missions[missionIndex - 1];
  const prevIdx = missionIndex - 1;
  return prev
    ? isMissionWordsDoneForGate(prev, knownWordIds, masteryByWordId, level, prevIdx)
    : true;
}

/** Missiya kartı: tamamlanıb (SRS bloku) və ya klassik sessiya bitib. */
export function isMissionMastered(
  missionNouns: NounEntry[],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  level: GoetheLevel,
  missionIndex: number,
): boolean {
  return isMissionWordsDoneForGate(missionNouns, knownWordIds, masteryByWordId, level, missionIndex);
}
