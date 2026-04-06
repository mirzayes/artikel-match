import { articleGrammarRules } from '../data/articleGrammarRules';
import type { Article } from '../types';
import { matchSuffixRule } from './ruleEngine';

const ARTICLE_HINT: Record<Article, string> = {
  der: 'der (kişi cinsi)',
  die: 'die (qadın cinsi)',
  das: 'das (orta cins)',
};

function parseArticledExample(s: string): { article: Article; lemma: string } | null {
  const m = s.trim().match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return null;
  return { article: m[1].toLowerCase() as Article, lemma: m[2].trim().toLowerCase() };
}

function findExceptionRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  for (const ex of articleGrammarRules.exceptions) {
    const parsed = parseArticledExample(ex.word);
    if (!parsed || parsed.lemma !== w) continue;
    if (ex.article === correctArticle) return ex.rule;
  }
  return null;
}

function findSemanticRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  for (const sr of articleGrammarRules.semanticRules) {
    if (sr.article !== correctArticle) continue;
    for (const ex of sr.examples) {
      const parsed = parseArticledExample(ex);
      if (parsed && parsed.lemma === w) return sr.rule;
    }
  }
  return null;
}

const ABBREVIATION_BY_TOKEN = new Map(
  articleGrammarRules.abbreviations.map((row) => [row.token.toUpperCase(), row]),
);

/** Yalnız qısa abreviaturalar (CD, BMW, SMS …). */
function normalizeAbbreviationKey(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s || !/^[A-Z0-9]+(?:-[A-Z0-9]+)?$/.test(s)) return null;
  return s;
}

function findAbbreviationRule(word: string, correctArticle: Article): string | null {
  const key = normalizeAbbreviationKey(word);
  if (!key) return null;
  const row = ABBREVIATION_BY_TOKEN.get(key);
  if (!row || row.article !== correctArticle) return null;
  return row.rule;
}

const TECH_TERM_EXCEPTION_BY_LEMMA = new Map(
  articleGrammarRules.techTerms.exceptions.map((row) => [row.word.toLowerCase(), row]),
);

const TECH_TERM_LIST_LEMMAS = new Set(
  articleGrammarRules.techTerms.list.map((w) => w.toLowerCase()),
);

function findTechTermRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;

  const ex = TECH_TERM_EXCEPTION_BY_LEMMA.get(w);
  if (ex) {
    if (ex.article !== correctArticle) return null;
    return ex.rule;
  }

  const { defaultArticle, defaultRule } = articleGrammarRules.techTerms;
  if (TECH_TERM_LIST_LEMMAS.has(w) && defaultArticle === correctArticle) {
    return defaultRule;
  }
  return null;
}

const GADGET_LEMMAS = new Set(
  [...articleGrammarRules.gadgets.neutral, ...articleGrammarRules.gadgets.masculine].map((x) =>
    x.toLowerCase(),
  ),
);

function gadgetExpectedArticle(lemmaLower: string): Article {
  return lemmaLower.endsWith('er') ? 'der' : 'das';
}

function findGadgetRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  if (!w || !GADGET_LEMMAS.has(w)) return null;

  const expected = gadgetExpectedArticle(w);
  if (expected !== correctArticle) return null;

  const { ruleDas, ruleDer } = articleGrammarRules.gadgets;
  return expected === 'der' ? ruleDer : ruleDas;
}

const DRINK_ARTICLE_BY_LEMMA: Map<string, Article> = (() => {
  const d = articleGrammarRules.drinks;
  const m = new Map<string, Article>();
  for (const x of d.feminine) m.set(x.toLowerCase(), 'die');
  for (const x of d.masculine) m.set(x.toLowerCase(), 'der');
  for (const x of d.neutral) m.set(x.toLowerCase(), 'das');
  return m;
})();

function findDrinksRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  const art = DRINK_ARTICLE_BY_LEMMA.get(w);
  if (!art || art !== correctArticle) return null;

  const d = articleGrammarRules.drinks;
  if (art === 'die') return d.ruleDie;
  if (art === 'der') return d.ruleDer;
  return d.ruleDas;
}

const TIME_LEMMAS = new Set(
  [
    ...articleGrammarRules.timeRules.daysOfWeek,
    ...articleGrammarRules.timeRules.months,
    ...articleGrammarRules.timeRules.seasons,
  ].map((x) => x.toLowerCase()),
);

function findTimeRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  if (!w || !TIME_LEMMAS.has(w) || correctArticle !== 'der') return null;
  return articleGrammarRules.timeRules.ruleDer;
}

const FEMININE_ER_LEMMAS = new Set(
  articleGrammarRules.feminineEr.words.map((x) => x.toLowerCase()),
);

function findFeminineErRule(word: string, correctArticle: Article): string | null {
  const w = word.trim().toLowerCase();
  if (!w || correctArticle !== 'die' || !FEMININE_ER_LEMMAS.has(w)) return null;
  return articleGrammarRules.feminineEr.rule;
}

/**
 * Səhv cavabdan sonra göstəriləcək izah: istisna → … → vaxt → feminin -er → semantik → sufiks.
 */
export function getArticleRule(word: string, correctArticle: Article): string {
  const display = word.trim();

  const exc = findExceptionRule(display, correctArticle);
  if (exc) return `${correctArticle} ${display}. ${exc}`;

  const abbr = findAbbreviationRule(display, correctArticle);
  if (abbr) return `${correctArticle} ${display}. ${abbr}`;

  const tech = findTechTermRule(display, correctArticle);
  if (tech) return `${correctArticle} ${display}. ${tech}`;

  const gad = findGadgetRule(display, correctArticle);
  if (gad) return `${correctArticle} ${display}. ${gad}`;

  const drink = findDrinksRule(display, correctArticle);
  if (drink) return `${correctArticle} ${display}. ${drink}`;

  const time = findTimeRule(display, correctArticle);
  if (time) return `${correctArticle} ${display}. ${time}`;

  const femEr = findFeminineErRule(display, correctArticle);
  if (femEr) return `${correctArticle} ${display}. ${femEr}`;

  const sem = findSemanticRule(display, correctArticle);
  if (sem) return `${correctArticle} ${display}. ${sem}`;

  const rule = matchSuffixRule(display);
  if (rule && rule.article === correctArticle) {
    return `${correctArticle} ${display}. ${rule.messageAz}`;
  }
  if (rule && rule.article !== correctArticle) {
    return `${correctArticle} ${display}. Ümumi sufiks qaydası (${rule.article}) burada tətbiq olunmur — bu lemmanı əzbərlə.`;
  }
  return `${correctArticle} — ${ARTICLE_HINT[correctArticle]}. Bu söz üçün fəal qayda yoxdur; təkrarla.`;
}
