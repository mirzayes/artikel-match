/**
 * c1-core.tsv + c1-az-supplement.tsv → src/data/words/c1.ts
 * Əvvəl əsas dəst, sonra əlavə; eyni lemma təkrarlanmır (əsas üstünlük verir).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const corePath = path.join(root, 'src/data/words/source/c1-core.tsv');
const supPath = path.join(root, 'src/data/words/source/c1-az-supplement.tsv');
const outPath = path.join(root, 'src/data/words/c1.ts');

function tsString(s) {
  return JSON.stringify(s);
}

function parseTsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split('\t');
    if (parts.length < 3) {
      console.warn('Atlanıldı (3 sütun yoxdur):', filePath, t.slice(0, 80));
      continue;
    }
    const word = parts[0].trim();
    const article = parts[1].trim().toLowerCase();
    const translation = parts.slice(2).join('\t').trim();
    if (!word || !translation) continue;
    if (article !== 'der' && article !== 'die' && article !== 'das') {
      console.warn('Atlanıldı (artikel):', filePath, t.slice(0, 80));
      continue;
    }
    rows.push({ word, article, translation });
  }
  return rows;
}

const coreRows = parseTsv(corePath);
const supRows = parseTsv(supPath);
const seen = new Set();
const merged = [];

for (const r of coreRows) {
  if (seen.has(r.word)) {
    console.warn('Təkrar (core):', r.word);
    continue;
  }
  seen.add(r.word);
  merged.push(r);
}

for (const r of supRows) {
  if (seen.has(r.word)) {
    console.warn('Təkrar atlandı (supplement):', r.word);
    continue;
  }
  seen.add(r.word);
  merged.push(r);
}

if (merged.length === 0) {
  console.error('Heç bir sətir yoxdur');
  process.exit(1);
}

const header = `import type { Article, NounEntry } from '../../types';

const L = 'C1' as const;

function e(suffix: string, article: Article, word: string, translation: string): NounEntry {
  return { id: \`c1-\${suffix}\`, level: L, article, word, translation };
}

/** C1: c1-core.tsv + c1-az-supplement.tsv — \`npm run sync-c1\` ilə yenilə. */
export const C1_NOUNS: NounEntry[] = [
`;

function idSuffix(i) {
  const n = i + 1;
  // Köhnə C1: c1-01…c1-60; 100+ üçün təbii uzunluq (c1-100).
  return n < 100 ? String(n).padStart(2, '0') : String(n);
}

const body = merged
  .map((r, i) => {
    const suffix = idSuffix(i);
    return `  e(${tsString(suffix)}, ${tsString(r.article)}, ${tsString(r.word)}, ${tsString(r.translation)}),`;
  })
  .join('\n');

const footer = `
];
`;

fs.writeFileSync(outPath, `${header}${body}\n${footer}`, 'utf8');
console.log('Yazıldı:', outPath, '| ümumi söz sayı:', merged.length, '| core:', coreRows.length, '| əlavə:', supRows.length);
