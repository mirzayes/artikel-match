import type { ExamSessionConfig, ExamTopicMode, GoetheLevel, NounEntry, NounTranslationLang } from '../../types';
import { excludeKnownNouns } from '../../lib/wordLists';
import { shuffleInPlace, type VokabelRow } from '../../lib/vokabelnCsv';
import { nounToVokabelRow } from '../../lib/nounTranslation';

export function nounsToRows(
  nouns: NounEntry[],
  glossLang: NounTranslationLang,
  remoteById?: Readonly<Record<string, string>> | null,
): VokabelRow[] {
  return nouns.map((n) => nounToVokabelRow(n, glossLang, remoteById));
}

export function buildExamRows(
  level: GoetheLevel,
  topics: ExamTopicMode,
  nounsByLevel: Record<GoetheLevel, NounEntry[]>,
  wrongCountByWordId: Record<string, number>,
  knownWordIds: string[],
  glossLang: NounTranslationLang,
  remoteById?: Readonly<Record<string, string>> | null,
): VokabelRow[] {
  const nouns = excludeKnownNouns(nounsByLevel[level], knownWordIds);
  if (topics === 'all') return nounsToRows(nouns, glossLang, remoteById);
  const wrong = nouns.filter((n) => (wrongCountByWordId[n.id] ?? 0) > 0);
  return nounsToRows(wrong, glossLang, remoteById);
}

export function buildFiniteQuestionOrder(rowCount: number, questionTotal: number): number[] {
  if (rowCount === 0) return [];
  const out: number[] = [];
  while (out.length < questionTotal) {
    out.push(...shuffleInPlace([...Array(rowCount).keys()]));
  }
  return out.slice(0, questionTotal);
}

export function buildInfiniteCycleOrder(rowCount: number): number[] {
  if (rowCount === 0) return [];
  return shuffleInPlace([...Array(rowCount).keys()]);
}

export function examQuestionCount(cfg: ExamSessionConfig): number | null {
  if (cfg.questions === 'infinite') return null;
  return cfg.questions;
}
