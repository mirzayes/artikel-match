import type { Article, GoetheLevel } from '../types';

export interface VokabelRow {
  id: string;
  article: Article;
  word: string;
  translation: string;
  /** Öyrənmə: statistika hansı Goethe səviyyəsinə yazılsın */
  level?: GoetheLevel;
}

const ARTICLES: Article[] = ['der', 'die', 'das'];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseAlmancaArticle(almancaRaw: string): { article: Article; word: string } | null {
  const almanca = almancaRaw.replace(/\s+/g, ' ').trim();
  const lower = almanca.toLowerCase();
  for (const a of ARTICLES) {
    const prefix = `${a} `;
    if (lower.startsWith(prefix)) {
      const word = almanca.slice(prefix.length).trim();
      if (!word) return null;
      return { article: a, word };
    }
  }
  return null;
}

/** CSV: Almanca, Azərbaycanca (başlıq sətri opsional) */
export function parseVokabelnCsv(text: string): VokabelRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows: VokabelRow[] = [];
  let rowIndex = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (cells.length < 2) continue;
    const [almancaCell, azCell] = cells;
    if (!almancaCell || azCell === undefined) continue;
    if (/^almanca$/i.test(almancaCell.trim())) continue;
    const parsed = parseAlmancaArticle(almancaCell);
    if (!parsed) continue;
    rows.push({
      id: `vokabeln-${rowIndex}`,
      article: parsed.article,
      word: parsed.word,
      translation: azCell.trim(),
    });
    rowIndex += 1;
  }
  return rows;
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
