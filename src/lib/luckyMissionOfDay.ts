import type { GoetheLevel, NounEntry } from '../types';
import { isMissionGateOpen } from './learnMissions';

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Bugün üçün təsadüfi bir kilidli missiya: eyni gün + səviyyə + cihaz üçün stabil seçim.
 * Yalnız hal-hazırda qapalı missiyalar arasından.
 */
export function pickLuckyMissionIndexForDay(args: {
  ymd: string;
  level: GoetheLevel;
  deviceKey: string;
  missions: NounEntry[][];
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  allMissionsPaidUnlocked: boolean;
}): number | null {
  const {
    ymd,
    level,
    deviceKey,
    missions,
    knownWordIds,
    masteryByWordId,
    allMissionsPaidUnlocked,
  } = args;
  if (missions.length <= 1 || allMissionsPaidUnlocked) return null;

  const locked: number[] = [];
  for (let i = 0; i < missions.length; i++) {
    const open = isMissionGateOpen(
      i,
      missions,
      knownWordIds,
      masteryByWordId,
      allMissionsPaidUnlocked,
      level,
    );
    if (!open) locked.push(i);
  }
  if (locked.length === 0) return null;

  const h = simpleHash(`${ymd}|${level}|${deviceKey}`);
  return locked[h % locked.length] ?? null;
}
