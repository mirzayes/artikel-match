import type { NounEntry } from '../types';
import { GOETHE_LEVELS, type GoetheLevel } from '../types';
import { chunkNounsIntoMissions, getMissionOrderedNouns } from './learnMissions';
import { MISSION_CITIES_INDEX_36_100, PLACEHOLDER_CITY_NAMES_101_299 } from './missionGermanCitiesPool';

export const AZ_VISITED_CITIES_STORAGE_KEY = 'az_visited_cities';

export type MissionGermanCity = {
  name: string;
  emoji: string;
  nickname: string;
  funFact: string;
};

/** Ardıcıllıq: qlobal missiya indeksinə görə (0, 1, 2, …). */
export const GERMAN_MISSION_CITIES: readonly MissionGermanCity[] = [
  { name: 'München', emoji: '🍺', nickname: 'Oktoberfeşt şəhəri', funFact: 'Dünyada ən böyük pivə festivalının vətəni' },
  { name: 'Berlin', emoji: '🎸', nickname: 'Paytaxt', funFact: 'Parisdən 9 dəfə böyük parka sahibdir' },
  { name: 'Hamburg', emoji: '⚓', nickname: 'Liman şəhəri', funFact: 'Avropanın ən böyük limanlarından biri' },
  { name: 'Frankfurt', emoji: '🏦', nickname: 'Maliyyə mərkəzi', funFact: 'Avropa Mərkəzi Bankının evi' },
  { name: 'Köln', emoji: '🎄', nickname: 'Katedrallər şəhəri', funFact: 'Köln Katedrali 632 il inşa edilib' },
  { name: 'Stuttgart', emoji: '🚗', nickname: 'Mercedes şəhəri', funFact: 'Mercedes və Porsche burada yaranıb' },
  { name: 'Dresden', emoji: '🎨', nickname: 'İncəsənət şəhəri', funFact: 'Elbanın Florensiyası adlanır' },
  { name: 'Heidelberg', emoji: '🏰', nickname: 'Qala şəhəri', funFact: 'Almaniyada ən romantik şəhər' },
  { name: 'Bremen', emoji: '🎭', nickname: 'Nağıl şəhəri', funFact: 'Qrimm qardaşlarının nağılının vətəni' },
  { name: 'Düsseldorf', emoji: '👔', nickname: 'Moda şəhəri', funFact: 'Almaniyada moda paytaxtı' },
  { name: 'Leipzig', emoji: '🎵', nickname: 'Musiqi şəhəri', funFact: 'Baxın doğulduğu şəhər' },
  { name: 'Nürnberg', emoji: '🪆', nickname: 'Tarix şəhəri', funFact: 'Ən məşhur Milad bazarı buradadır' },
  { name: 'Hannover', emoji: '🌿', nickname: 'Bağ şəhəri', funFact: 'Dünyanın ən böyük sərgi mərkəzi' },
  { name: 'Bonn', emoji: '🎹', nickname: 'Bethoven şəhəri', funFact: 'Bethoven 1770-ci ildə burada anadan olub' },
  { name: 'Freiburg', emoji: '☀️', nickname: 'Günəş şəhəri', funFact: 'Almaniyada ən günəşli şəhər' },
  { name: 'Regensburg', emoji: '🌉', nickname: 'Körpü şəhəri', funFact: '2000 illik tarixi var' },
  { name: 'Augsburg', emoji: '🏛️', nickname: 'Roma şəhəri', funFact: 'Romanın Almaniyadakı ilk şəhəri' },
  { name: 'Würzburg', emoji: '🍷', nickname: 'Şərab şəhəri', funFact: 'Frankoniyanın şərab paytaxtı' },
  { name: 'Erfurt', emoji: '🌸', nickname: 'Çiçək şəhəri', funFact: 'Martin Lüter burada oxuyub' },
  { name: 'Jena', emoji: '🔬', nickname: 'Elm şəhəri', funFact: 'Zeiss optika şirkətinin vətəni' },
  { name: 'Rostock', emoji: '⛵', nickname: 'Dəniz şəhəri', funFact: 'Baltik dənizinin incisi' },
  { name: 'Kiel', emoji: '🌊', nickname: 'Kanal şəhəri', funFact: 'Dünyanın ən məşğul kanallarından biri' },
  { name: 'Lübeck', emoji: '🍫', nickname: 'Marşipan şəhəri', funFact: 'Marşipanın vətəni' },
  { name: 'Potsdam', emoji: '👑', nickname: 'Saray şəhəri', funFact: 'Sansusi sarayı burada yerləşir' },
  { name: 'Mainz', emoji: '📰', nickname: 'Mətbuat şəhəri', funFact: 'Qutenbergin vətəni — çap maşını buradan' },
  { name: 'Trier', emoji: '🏺', nickname: 'Ən qədim şəhər', funFact: 'Almaniyada ən qədim Roma şəhəri' },
  { name: 'Aachen', emoji: '👑', nickname: 'Kral şəhəri', funFact: 'Böyük Karlın paytaxtı olub' },
  { name: 'Münster', emoji: '🚲', nickname: 'Velosiped şəhəri', funFact: 'Hər sakin üçün 2 velosiped var' },
  { name: 'Dortmund', emoji: '⚽', nickname: 'Futbol şəhəri', funFact: 'Borussiyanın vətəni' },
  { name: 'Bochum', emoji: '🎭', nickname: 'Teatr şəhəri', funFact: 'Almaniyada ən çox teatr' },
  { name: 'Essen', emoji: '🏭', nickname: 'Sənaye şəhəri', funFact: 'Köhnə mədən şəhəri, indi incəsənət mərkəzi' },
  { name: 'Wiesbaden', emoji: '💆', nickname: 'Spa şəhəri', funFact: 'Romanların sevimli istirahət yeri' },
  { name: 'Darmstadt', emoji: '🚀', nickname: 'Texnologiya şəhəri', funFact: 'Avropa kosmik mərkəzi buradadır' },
  { name: 'Mannheim', emoji: '🎹', nickname: 'Musiqi şəhəri', funFact: 'Fortepianonun ixtira edildiyi şəhər' },
  { name: 'Karlsruhe', emoji: '⚖️', nickname: 'Hüquq şəhəri', funFact: 'Almaniya Ali Məhkəməsi buradadır' },
  { name: 'Konstanz', emoji: '🏖️', nickname: 'Göl şəhəri', funFact: 'Bodensee gölünün sahilindədir' },
] as const;

/** Ümumi şəhər hovuzu: 0–35 əsas, 36–100 genişləndirilmiş, 101–299 ad + ümumi təsvir. */
export const MISSION_CITY_POOL_SIZE =
  GERMAN_MISSION_CITIES.length + MISSION_CITIES_INDEX_36_100.length + PLACEHOLDER_CITY_NAMES_101_299.length;

function missionCountForLevel(level: GoetheLevel, nounsByLevel: Record<GoetheLevel, NounEntry[]>): number {
  const nouns = nounsByLevel[level] ?? [];
  return chunkNounsIntoMissions(getMissionOrderedNouns(level, nouns)).length;
}

/** Bütün Goethe səviyyələri üzrə ardıcıllıq: əvvəl A1 missiyaları, sonra A2, … */
export function getGlobalMissionIndex(
  level: GoetheLevel,
  missionSlotIndex: number,
  nounsByLevel: Record<GoetheLevel, NounEntry[]>,
): number {
  let offset = 0;
  for (const L of GOETHE_LEVELS) {
    if (L === level) {
      return offset + missionSlotIndex;
    }
    offset += missionCountForLevel(L, nounsByLevel);
  }
  return offset + missionSlotIndex;
}

export function normalizeMissionCityIndex(globalMissionIndex: number): number {
  const n = MISSION_CITY_POOL_SIZE;
  if (n === 0) return 0;
  const m = globalMissionIndex % n;
  return m < 0 ? m + n : m;
}

export function cityIndexForGlobalMission(globalMissionIndex: number): number {
  return normalizeMissionCityIndex(globalMissionIndex);
}

/**
 * Qlobal missiya indeksinə görə şəhər məlumatı: 0–35 hazır siyahı,
 * 36–100 genişləndirilmiş, 101–299 real ad + ümumi emoji/ləqəb/fakt.
 */
export function getMissionCityData(missionCityIndex: number): MissionGermanCity {
  const idx = normalizeMissionCityIndex(missionCityIndex);
  if (idx < GERMAN_MISSION_CITIES.length) {
    const c = GERMAN_MISSION_CITIES[idx]!;
    return { name: c.name, emoji: c.emoji, nickname: c.nickname, funFact: c.funFact };
  }
  if (idx <= 100) {
    const c = MISSION_CITIES_INDEX_36_100[idx - 36]!;
    return { name: c.name, emoji: c.emoji, nickname: c.nickname, funFact: c.funFact };
  }
  const name =
    PLACEHOLDER_CITY_NAMES_101_299[idx - 101] ?? `Şəhər ${idx}`;
  return {
    name,
    emoji: '🏙️',
    nickname: 'Alman şəhəri',
    funFact: 'Almaniyada gözəl şəhərlərdən biri',
  };
}

export function readVisitedCityIndexes(): number[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AZ_VISITED_CITIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const max = MISSION_CITY_POOL_SIZE;
    return parsed.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < max);
  } catch {
    return [];
  }
}

/** Bu şəhəri ziyarət edilmiş kimi qeyd edir; qayıdır: unikal şəhər sayı. */
export function recordVisitedCityIndex(cityIndex: number): number {
  if (typeof localStorage === 'undefined') return 1;
  const max = MISSION_CITY_POOL_SIZE;
  if (cityIndex < 0 || cityIndex >= max) return readVisitedCityIndexes().length;
  const prev = readVisitedCityIndexes();
  const uniq = new Set(prev);
  uniq.add(cityIndex);
  const next = [...uniq].sort((a, b) => a - b);
  try {
    localStorage.setItem(AZ_VISITED_CITIES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return uniq.size;
}
