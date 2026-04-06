/**
 * CSV mənbələri → public/goethe-lexicon.json (A1 + A2).
 * A1: goethe-a1-az.csv
 * A2: goethe-a2-az.csv (adətən yalnız isimlər; tam lüğət: goethe-a2-full-vocabulary.csv)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'src/data/words/source');
const outPath = path.join(root, 'public/goethe-lexicon.json');

/** Hər səviyyə üçün ayrı fayl; deduplikasiya səviyyə daxilindədir (A2 siyahısı tam saxlanılır). */
const CSV_BY_LEVEL = [
  { level: 'A1', file: 'goethe-a1-az.csv', idPrefix: 'a1' },
  { level: 'A2', file: 'goethe-a2-az.csv', idPrefix: 'a2' },
];

/** Viktorinaya düşməməli kateqoriyalar (fel, ədat, sifət …). */
const EXCLUDED_CATEGORY_MARKERS = [
  'fel',
  'ədat',
  'bağlayıcı',
  'sifət',
  'zərf',
  'əvəzlik',
  'sual',
  'artikl',
  'modalverb',
  'hilfsverb',
  'ifadə',
  'ailə vəziyyəti',
];

function normalizeCategory(cat) {
  return String(cat)
    .replace(/\s*\[cite:\s*\d+\]\s*/gi, '')
    .trim();
}

function categoryExcluded(catRaw) {
  const cat = normalizeCategory(catRaw).toLowerCase();
  return EXCLUDED_CATEGORY_MARKERS.some(
    (e) => cat === e || cat.startsWith(e + ' ') || cat.startsWith(e + '['),
  );
}

/** Lüğətdə göstərmə üçün: "İsim / Kleidung" → "Kleidung" */
function categoryLabelFromRow(catRaw) {
  const c = normalizeCategory(catRaw);
  if (!c) return 'Digər';
  const m = c.match(/^İsim\s*\/\s*(.+)$/i);
  if (m) return m[1].trim();
  return c;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === ',' && !inQuotes) {
      row.push(unquoteField(cur));
      cur = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (cur.length || row.length) {
        row.push(unquoteField(cur));
        if (row.some((x) => String(x).trim())) rows.push(row);
        row = [];
        cur = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(unquoteField(cur));
    if (row.some((x) => String(x).trim())) rows.push(row);
  }
  return rows;
}

function unquoteField(s) {
  let t = String(s).trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

function splitGermanSegments(german) {
  const t = german.trim();
  if (/^der\s*\/\s*die\s*\/\s*das$/i.test(t.replace(/\s+/g, ' '))) return [];
  if (/\s\/\s+(der|die|das)\s/i.test(t)) {
    return t.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
  }
  return [t];
}

function expandSpecialLists(german, az, rowCategoryLabel) {
  const g = german.trim();
  const specs = [
    {
      re: /^der\s+Frühling\s*\/\s*Sommer/i,
      article: 'der',
      words: ['Frühling', 'Sommer', 'Herbst', 'Winter'],
      translations: ['yaz', 'yay', 'payız', 'qış'],
      category: 'Fəsil',
    },
    {
      re: /^der\s+Norden\s*\/\s*Süden/i,
      article: 'der',
      words: ['Norden', 'Süden', 'Westen', 'Osten'],
      translations: ['şimal', 'cənub', 'qərb', 'şərq'],
      category: 'İstiqamət',
    },
    {
      re: /^der\s+Januar\s*\/\s*Februar/i,
      article: 'der',
      words: [
        'Januar',
        'Februar',
        'März',
        'April',
        'Mai',
        'Juni',
        'Juli',
        'August',
        'September',
        'Oktober',
        'November',
        'Dezember',
      ],
      category: 'Ay',
    },
  ];
  for (const { re, article, words, category, translations } of specs) {
    if (re.test(g)) {
      const cat = category || rowCategoryLabel;
      const fallback = az.trim();
      return words.map((word, i) => ({
        article,
        word,
        translation: (translations?.[i] ?? fallback).trim(),
        category: cat,
      }));
    }
  }
  return null;
}

function extractLemma(segment) {
  const s = segment.trim();
  const out = [];

  const dd = s.match(/^der\/die\s+([^,(]+)/i);
  if (dd) {
    let w = dd[1].trim();
    const cut = w.search(/[,(]/);
    if (cut !== -1) w = w.slice(0, cut).trim();
    w = w.replace(/\s*\(Sg\.\)\s*$/i, '').replace(/\s*\(Pl\.\)\s*$/i, '').trim();
    if (w) {
      out.push({ article: 'der', word: w });
      out.push({ article: 'die', word: w });
    }
    return out;
  }

  const m = s.match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return out;
  const art = m[1].toLowerCase();
  let rest = m[2].trim();
  const cut = rest.search(/[,(]/);
  if (cut !== -1) rest = rest.slice(0, cut).trim();
  rest = rest.replace(/\s*\(Sg\.\)\s*$/i, '').replace(/\s*\(Pl\.\)\s*$/i, '').trim();
  if (!rest) return out;

  const word = rest.split(/\s+/)[0];
  if (!word || word === '-') return out;
  out.push({ article: art, word });
  return out;
}

function resolveColumns(table) {
  if (table.length === 0) return null;
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idxDe = header.findIndex((h) => h.includes('almanca'));
  const idxAz = header.findIndex((h) => h.includes('azərbaycan'));
  const idxCat = header.findIndex((h) => h.includes('kateqoriya'));
  if (idxDe < 0 || idxAz < 0 || idxCat < 0) return null;
  const h0 = String(table[0][idxDe] ?? '')
    .trim()
    .toLowerCase();
  const skipHeader = h0.includes('almanca');
  return { idxDe, idxAz, idxCat, startRow: skipHeader ? 1 : 0 };
}

/** goethe-a2-az.csv: hər sətir `der Wort — tərcümə` (vergülsüz). */
function parseEmDashNounLines(text) {
  const header = ['Almanca', 'Azərbaycanca', 'Kateqoriya'];
  const rows = [header];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const sep = /\s+—\s+/;
    if (!sep.test(t)) continue;
    const [left, translation] = t.split(sep).map((s) => s.trim());
    if (!left || !translation) continue;
    if (!/^(der|die|das)\s/i.test(left)) continue;
    rows.push([left, translation, 'İsim']);
  }
  return rows.length > 1 ? rows : null;
}

function processTable(table, cols, list, seen, stats, idPrefix) {
  const { idxDe, idxAz, idxCat, startRow } = cols;

  for (let r = startRow; r < table.length; r++) {
    const row = table[r];
    const german = row[idxDe] ?? '';
    const az = (row[idxAz] ?? '').trim();
    const cat = row[idxCat] ?? '';

    if (categoryExcluded(cat)) {
      stats.skipped++;
      continue;
    }
    if (!/^(der|die|das)(\/|\s)/i.test(german.trim())) {
      stats.skipped++;
      continue;
    }

    const rowCatLabel = categoryLabelFromRow(cat);

    const special = expandSpecialLists(german, az, rowCatLabel);
    if (special) {
      for (const { article, word, translation, category: itemCat } of special) {
        const key = `${article}|${word.toLowerCase()}|${translation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: `${idPrefix}-csv-${list.length + 1}`,
          article,
          word,
          translation,
          category: itemCat,
        });
      }
      continue;
    }

    const segments = splitGermanSegments(german);
    for (const seg of segments) {
      const lems = extractLemma(seg);
      for (const { article, word } of lems) {
        const key = `${article}|${word.toLowerCase()}|${az}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: `${idPrefix}-csv-${list.length + 1}`,
          article,
          word,
          translation: az,
          category: rowCatLabel,
        });
      }
    }
  }
}

function main() {
  const lexicon = {
    A1: [],
    A2: [],
    B1: [],
    B2: [],
    C1: [],
  };

  const usedFiles = [];

  for (const { level, file, idPrefix } of CSV_BY_LEVEL) {
    const csvPath = path.join(sourceDir, file);
    if (!fs.existsSync(csvPath)) continue;

    const text = fs.readFileSync(csvPath, 'utf8');
    let table = parseCSV(text);
    let cols = resolveColumns(table);
    if (!cols) {
      const alt = parseEmDashNounLines(text);
      if (alt) {
        table = alt;
        cols = resolveColumns(table);
      }
    }
    if (!cols) {
      console.error('Başlıqlar uyğun deyil:', csvPath, table[0]);
      process.exit(1);
    }
    if (table.length === 0) continue;

    const seen = new Set();
    const stats = { skipped: 0 };
    processTable(table, cols, lexicon[level], seen, stats, idPrefix);
    usedFiles.push(`${file} → ${level} (${lexicon[level].length} isim, ${stats.skipped} atlanan)`);
  }

  if (lexicon.A1.length === 0) {
    console.error('goethe-a1-az.csv tapılmadı və ya boşdur:', sourceDir);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(lexicon, null, 0), 'utf8');
  console.log('Yazıldı:', outPath);
  for (const line of usedFiles) console.log(line);
  console.log('Cəmi A1:', lexicon.A1.length, '| A2:', lexicon.A2.length);
}

main();
