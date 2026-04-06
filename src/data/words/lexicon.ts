import type { Article, GoetheLevel, NounEntry, NounTranslations } from '../../types';
import { GOETHE_LEVELS } from '../../types';

function isArticle(x: unknown): x is Article {
  return x === 'der' || x === 'die' || x === 'das';
}

function slugId(level: GoetheLevel, index: number, word: string): string {
  const safe = word
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9äöü]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${level.toLowerCase()}-lex-${index}-${safe || 'x'}`;
}

/** JSON kökü birbaşa səviyyə açarları və ya { levels: { A1: [...] } } ola bilər. */
function unwrapLevelsPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if ('levels' in o && o.levels && typeof o.levels === 'object') {
    return o.levels as Record<string, unknown>;
  }
  return o;
}

/**
 * İstifadəçi təqdim etdiyi JSON-u təhlil edir. Hər element: { article, word, translation }.
 * Rəsmi Goethe PDF məzmununu bu layihəyə köçürmək üçün faylı özünüz yaradın / yeniləyin (hüquqi məsuliyyət sizdədir).
 */
export function parseGoetheLexiconJson(data: unknown): Record<GoetheLevel, NounEntry[]> | null {
  const root = unwrapLevelsPayload(data);
  if (!root) return null;

  const out = {} as Record<GoetheLevel, NounEntry[]>;
  let any = false;

  for (const lvl of GOETHE_LEVELS) {
    const raw = root[lvl];
    if (!Array.isArray(raw)) {
      out[lvl] = [];
      continue;
    }
    const entries: NounEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const article = r.article;
      const word = r.word;
      const translation = r.translation;
      if (!isArticle(article) || typeof word !== 'string' || typeof translation !== 'string') continue;
      const w = word.trim();
      const t = translation.trim();
      if (!w || !t) continue;
      const rawTr = r.translations;
      const fromFile: NounTranslations = {};
      if (rawTr && typeof rawTr === 'object' && !Array.isArray(rawTr)) {
        const o = rawTr as Record<string, unknown>;
        const pick = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');
        if (pick('az')) fromFile.az = pick('az');
        /* en/ru/tr/kr/zh/es/ar — yalnız public/lexicon-glosses/*.json */
        if (pick('hi')) fromFile.hi = pick('hi');
      }
      const mergedTr: NounTranslations = { az: t, ...fromFile };
      if (fromFile.az?.trim()) mergedTr.az = fromFile.az.trim();
      entries.push({
        id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : slugId(lvl, i, w),
        level: lvl,
        article,
        word: w,
        translation: t,
        translations: mergedTr,
      });
    }
    out[lvl] = entries;
    if (entries.length > 0) any = true;
  }

  return any ? out : null;
}

/** Boş qalan səviyyələr üçün daxili (bundled) siyahıya qayıt. */
export function mergeLexiconWithBundled(
  parsed: Record<GoetheLevel, NounEntry[]>,
  bundled: Record<GoetheLevel, NounEntry[]>,
): Record<GoetheLevel, NounEntry[]> {
  const out = {} as Record<GoetheLevel, NounEntry[]>;
  for (const l of GOETHE_LEVELS) {
    out[l] = parsed[l].length > 0 ? parsed[l] : bundled[l];
  }
  return out;
}

export function buildWordCounts(byLevel: Record<GoetheLevel, NounEntry[]>): {
  wordCountByLevel: Record<GoetheLevel, number>;
  totalWordCount: number;
} {
  const wordCountByLevel = {} as Record<GoetheLevel, number>;
  let totalWordCount = 0;
  for (const l of GOETHE_LEVELS) {
    const n = byLevel[l].length;
    wordCountByLevel[l] = n;
    totalWordCount += n;
  }
  return { wordCountByLevel, totalWordCount };
}
