import type { NounEntry } from '../types';
import { isLearnBlockMastered } from './learnBlocks';

/** Öyrənmə mövzusu: hər missiyada bu qədər isim (blokdan ayrı; sessiya ölçüsü 20 qalır). */
export const LEARNING_MISSION_WORD_COUNT = 25;

/** Missiya ilk dəfə tamamlandıqda (limitdən kənar). */
export const LEARNING_MISSION_ARTIK_REWARD = 50;

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
