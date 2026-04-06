/**
 * public/goethe-lexicon.json → src/data/words/source/goethe-a2-az.csv
 * Yalnız A2 isimləri (700): Almanca = article + word, Kateqoriya = İsim.
 * Tam lüğət siyahısı üçün goethe-a2-full-vocabulary.csv saxlanılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const lexPath = path.join(root, 'public/goethe-lexicon.json');
const outPath = path.join(root, 'src/data/words/source/goethe-a2-az.csv');

function csvField(s) {
  const t = String(s);
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

const lex = JSON.parse(fs.readFileSync(lexPath, 'utf8'));
const a2 = lex.A2;
if (!Array.isArray(a2) || a2.length === 0) {
  console.error('A2 boşdur:', lexPath);
  process.exit(1);
}

const lines = ['Almanca,Azərbaycanca,Kateqoriya'];
for (const e of a2) {
  const almanca = `${e.article} ${e.word}`;
  lines.push(
    [csvField(almanca), csvField(e.translation), csvField('İsim')].join(','),
  );
}
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log('Yazıldı:', outPath, '| sətir (başlıq + isim):', lines.length);
