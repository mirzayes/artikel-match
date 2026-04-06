/**
 * src/data/words/source/goethe-a2-az.csv → src/data/words/a2.ts
 * CSV: Almanca,Azərbaycanca,Kateqoriya (birinci sütun: "der Wort" formatı).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'src/data/words/source/goethe-a2-az.csv');
const outPath = path.join(root, 'src/data/words/a2.ts');

function parseArticled(almanca) {
  const m = almanca.trim().match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return null;
  const article = m[1].toLowerCase();
  const word = m[2].trim();
  if (!word) return null;
  return { article, word };
}

/** CSV: der Wort,az,İsim — və ya bir sətir: der Wort — az */
function parseLine(line) {
  const t = line.trim();
  if (!t) return null;

  if (t.includes(' — ')) {
    const [left, translation] = t.split(/\s+—\s+/).map((s) => s.trim());
    const p = parseArticled(left);
    if (!p || !translation) return null;
    return { ...p, translation };
  }

  const parts = t.split(',');
  if (parts.length !== 3) return null;
  const [almanca, translation, category] = parts.map((s) => s.trim());
  if (!almanca || !translation) return null;
  if (category === 'Kateqoriya') return null;
  const p = parseArticled(almanca);
  if (!p) return null;
  return { ...p, translation };
}

function tsString(s) {
  return JSON.stringify(s);
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/);
const rows = [];
for (const line of lines) {
  if (!line.trim()) continue;
  const row = parseLine(line);
  if (row) rows.push(row);
}

if (rows.length === 0) {
  console.error('Heç bir sətir parse olunmadı:', csvPath);
  process.exit(1);
}

const header = `import type { Article, NounEntry } from '../../types';

const L = 'A2' as const;

function e(suffix: string, article: Article, word: string, translation: string): NounEntry {
  return { id: \`a2-\${suffix}\`, level: L, article, word, translation };
}

/** A2: goethe-a2-az.csv ilə sinxron (İsimlər). \`npm run sync-a2\` ilə yenilə. */
export const A2_NOUNS: NounEntry[] = [
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
