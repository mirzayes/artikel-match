import type { GoetheLevel, NounEntry } from '../types';
import { isLearnBlockMastered } from './learnBlocks';

/** Öyrənmə mövzusu: hər missiyada bu qədər isim (blokdan ayrı; sessiya ölçüsü 20 qalır). */
export const LEARNING_MISSION_WORD_COUNT = 25;

/** Missiya ilk dəfə tamamlandıqda (limitdən kənar). */
export const LEARNING_MISSION_ARTIK_REWARD = 50;

const MISSION_ORDER_STORAGE_PREFIX = 'mission_order_';

function missionOrderStorageKey(level: GoetheLevel): string {
  return `${MISSION_ORDER_STORAGE_PREFIX}${level}`;
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

/** Missiya 0 həmişə; növbəti — əvvəlki mənimsənilib və ya ödənişlə hamısı açılıb. */
export function isMissionGateOpen(
  missionIndex: number,
  missions: NounEntry[][],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  allMissionsPaidUnlocked: boolean,
): boolean {
  if (allMissionsPaidUnlocked) return true;
  if (missionIndex <= 0) return true;
  const prev = missions[missionIndex - 1];
  return prev ? isLearnBlockMastered(prev, knownWordIds, masteryByWordId) : true;
}

export const isMissionMastered = isLearnBlockMastered;
