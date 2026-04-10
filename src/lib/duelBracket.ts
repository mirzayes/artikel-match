import type { GoetheLevel } from '../types';
import type { DuelTier } from '../store/useGameStore';

/** RTDB PvP: ayrı sözlük + mərc miqyası. */
export type DuelBracket = 'novice' | 'elite';

export function duelBracketForLevel(level: GoetheLevel): DuelBracket {
  return level === 'B2' || level === 'C1' ? 'elite' : 'novice';
}

/** Sadə sözlər (A1–A2). B1 öyrənmə səviyyəsi eyni mərc qrupundadır, lakin söz bazası A1–A2-dir. */
export const NOVICE_DUEL_WORD_LEVELS = ['A1', 'A2'] as const satisfies readonly GoetheLevel[];

/** Akademik / çətin leksika + artikllar. */
export const ELITE_DUEL_WORD_LEVELS = ['B2', 'C1'] as const satisfies readonly GoetheLevel[];

export function wordLevelsForDuelBracket(bracket: DuelBracket): readonly GoetheLevel[] {
  return bracket === 'elite' ? ELITE_DUEL_WORD_LEVELS : NOVICE_DUEL_WORD_LEVELS;
}

/**
 * Eyni üç pillə (sadə / ciddi / ekspert), amma baza mərc: novice 50, elite 500.
 */
export function getDuelTiersForBracket(bracket: DuelBracket): DuelTier[] {
  if (bracket === 'novice') {
    return [
      { id: 'sade', entryFee: 50, prize: 100 },
      { id: 'ciddi', entryFee: 100, prize: 200 },
      { id: 'ekspert', entryFee: 200, prize: 400 },
    ];
  }
  return [
    { id: 'sade', entryFee: 500, prize: 1000 },
    { id: 'ciddi', entryFee: 1000, prize: 2000 },
    { id: 'ekspert', entryFee: 2000, prize: 4000 },
  ];
}
