import type { GoetheLevel, NounEntry } from '../../types';
import { GOETHE_LEVELS } from '../../types';

const CHUNK_SIZE = 50;

const LEVEL_MODULES: Record<GoetheLevel, () => Promise<{ list: NounEntry[] }>> = {
  A1: () => import('./a1').then((m) => ({ list: m.A1_NOUNS })),
  A2: () => import('./a2').then((m) => ({ list: m.A2_NOUNS })),
  B1: () => import('./b1').then((m) => ({ list: m.B1_NOUNS })),
  B2: () => import('./b2').then((m) => ({ list: m.B2_NOUNS })),
  C1: () => import('./c1').then((m) => ({ list: m.C1_NOUNS })),
};

export function emptyNounsByLevel(): Record<GoetheLevel, NounEntry[]> {
  return { A1: [], A2: [], B1: [], B2: [], C1: [] };
}

function cloneState(state: Record<GoetheLevel, NounEntry[]>): Record<GoetheLevel, NounEntry[]> {
  const out = {} as Record<GoetheLevel, NounEntry[]>;
  for (const l of GOETHE_LEVELS) {
    out[l] = state[l].slice();
  }
  return out;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      queueMicrotask(() => resolve());
    }
  });
}

/**
 * Dinamik import + 50-lik hissələr: ilkin JS paketi kiçilir, UI bloklanmır.
 */
export async function loadBundledLexiconProgressive(options: {
  onUpdate: (next: Record<GoetheLevel, NounEntry[]>) => void;
}): Promise<Record<GoetheLevel, NounEntry[]>> {
  const state = emptyNounsByLevel();

  for (const lvl of GOETHE_LEVELS) {
    const { list } = await LEVEL_MODULES[lvl]();
    for (let i = 0; i < list.length; i += CHUNK_SIZE) {
      state[lvl] = state[lvl].concat(list.slice(i, i + CHUNK_SIZE));
      options.onUpdate(cloneState(state));
      await yieldToMain();
    }
  }

  return cloneState(state);
}

export async function applyNounsByLevelInChunks(
  source: Record<GoetheLevel, NounEntry[]>,
  onUpdate: (next: Record<GoetheLevel, NounEntry[]>) => void,
): Promise<void> {
  const state = emptyNounsByLevel();
  for (const lvl of GOETHE_LEVELS) {
    const list = source[lvl];
    state[lvl] = [];
    for (let i = 0; i < list.length; i += CHUNK_SIZE) {
      state[lvl] = state[lvl].concat(list.slice(i, i + CHUNK_SIZE));
      onUpdate(cloneState(state));
      await yieldToMain();
    }
  }
}
