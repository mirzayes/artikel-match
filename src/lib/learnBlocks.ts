import { LEARNED_FOR_TRAINING_MASTERY, LEARNING_SESSION_BATCH_SIZE, type NounEntry } from '../types';

/** Öyrənmə mövzu ekranı: hər blokda bu qədər isim (sessiya ölçüsü ilə eyni). */
export const LEARN_WORD_BLOCK_SIZE = LEARNING_SESSION_BATCH_SIZE;

/** Bütün blokları ardıcıllıq olmadan açmaq üçün bir dəfə ödəniş (səviyyə üzrə). */
export const LEARN_BLOCKS_UNLOCK_ALL_COST = 500;

export function chunkNounsIntoLearnBlocks(nouns: NounEntry[]): NounEntry[][] {
  if (nouns.length === 0) return [];
  const blocks: NounEntry[][] = [];
  for (let i = 0; i < nouns.length; i += LEARN_WORD_BLOCK_SIZE) {
    blocks.push(nouns.slice(i, i + LEARN_WORD_BLOCK_SIZE));
  }
  return blocks;
}

/** Dashboard ilə eyni: «bilinən» və ya öyrənmə mastery ≥ 5. */
export function isLearnBlockMastered(
  blockNouns: NounEntry[],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
): boolean {
  if (blockNouns.length === 0) return true;
  const known = new Set(knownWordIds);
  return blockNouns.every((n) => {
    if (known.has(n.id)) return true;
    return (masteryByWordId[n.id] ?? 0) >= LEARNED_FOR_TRAINING_MASTERY;
  });
}

export function formatLearnBlockRange(blockIndex: number, blockNouns: NounEntry[]): string {
  const start = blockIndex * LEARN_WORD_BLOCK_SIZE + 1;
  const end = blockIndex * LEARN_WORD_BLOCK_SIZE + blockNouns.length;
  return `${start}–${end}`;
}

/** Blok 0 həmişə (premium yoxdursa); növbəti bloklar — əvvəlki mənimsənilib və ya ödənişlə açılıb. */
export function isLearnBlockGateOpen(
  blockIndex: number,
  blocks: NounEntry[][],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  allBlocksPaidUnlocked: boolean,
): boolean {
  if (allBlocksPaidUnlocked) return true;
  if (blockIndex <= 0) return true;
  const prev = blocks[blockIndex - 1];
  return prev ? isLearnBlockMastered(prev, knownWordIds, masteryByWordId) : true;
}
