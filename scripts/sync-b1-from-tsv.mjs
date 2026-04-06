/**
 * src/data/words/source/goethe-b1-az.tsv → src/data/words/b1.ts
 * Sütunlar: Lemma\tder|die|das\tAzərbaycan tərcüməsi
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const tsvPath = path.join(root, 'src/data/words/source/goethe-b1-az.tsv');
const outPath = path.join(root, 'src/data/words/b1.ts');

function tsString(s) {
  return JSON.stringify(s);
}

const raw = fs.readFileSync(tsvPath, 'utf8');
const lines = raw.split(/\r?\n/);
const rows = [];
const seen = new Set();

for (const line of lines) {
  const t = line.trim();
  if (!t) continue;
  const parts = t.split('\t');
  if (parts.length < 3) {
    console.warn('Atlanıldı (3 sütun yoxdur):', t.slice(0, 80));
    continue;
  }
  const word = parts[0].trim();
  const article = parts[1].trim().toLowerCase();
  const translation = parts.slice(2).join('\t').trim();
  if (!word || !translation) continue;
  if (article !== 'der' && article !== 'die' && article !== 'das') {
    console.warn('Atlanıldı (artikel yoxdur):', t.slice(0, 80));
    continue;
  }
  const key = `${word}\t${article}`;
  if (seen.has(key)) {
    console.warn('Təkrar atlandı:', key);
    continue;
  }
  seen.add(key);
  rows.push({ word, article, translation });
}

if (rows.length === 0) {
  console.error('Heç bir sətir parse olunmadı:', tsvPath);
  process.exit(1);
}

const header = `import type { Article, NounEntry } from '../../types';

const L = 'B1' as const;

function e(suffix: string, article: Article, word: string, translation: string): NounEntry {
  return { id: \`b1-\${suffix}\`, level: L, article, word, translation };
}

/** B1: goethe-b1-az.tsv ilə sinxron (İsimlər). \`npm run sync-b1\` ilə yenilə. */
export const B1_NOUNS: NounEntry[] = [
`;

const body = rows
  .map((r, i) => {
    const suffix = String(i + 1).padStart(3, '0');
    return `  e(${tsString(suffix)}, ${tsString(r.article)}, ${tsString(r.word)}, ${tsString(r.translation)}),`;
  })
  .join('\n');

const footer = `
];
`;

fs.writeFileSync(outPath, `${header}${body}\n${footer}`, 'utf8');
console.log('Yazıldı:', outPath, '| söz sayı:', rows.length);
